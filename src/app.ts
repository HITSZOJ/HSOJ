import os from "os";
import express from "express";
import formData from "express-form-data";
import config from "./config/config";
import problemManager, { Problem, ProblemBrief } from "./problem/problem";
import { User, userManager } from "./user/user";
import * as session from "express-session";
import expressMySqlSession from "express-mysql-session";
import submissionManager, {
  FailSubmission,
  Language,
  SubmissionStatus,
} from "./submission/submission";
import judger from "./judger/judger";
import fs from "fs";
import { readStream, submissionStatusColor } from "./utils/utils";

const app: express.Application = express();
const ExpressMySqlStoreSession = expressMySqlSession(session);

app.set("view engine", "ejs");
app.use(express.static("static"));
app.use(express.urlencoded({ extended: true }));

declare module "express-session" {
  interface SessionData {
    user: User;
  }
}

const formDataoptions = {
  uploadDir: os.tmpdir(),
  autoClean: true,
};

const sessionOptions = {
  connectionLimit: 10,
  password: config.db.password,
  user: config.db.user,
  database: config.db.database,
  host: config.db.host,
  port: config.db.port,
  createDatabaseTable: false,
  schema: {
    tableName: "sessions",
    columnNames: {
      session_id: "session_id",
      expires: "expires",
      data: "data",
    },
  },
};
let sessionStore = new ExpressMySqlStoreSession(sessionOptions);

app.use(
  session.default({
    secret: config.secret,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7 * 2, // 2 weeks
    },
  })
);

// parse data with connect-multiparty.
app.use(formData.parse(formDataoptions));
// delete from the request all empty files (size == 0)
app.use(formData.format());
// change the file objects to fs.ReadStream
app.use(formData.stream());
// union the body and the files
app.use(formData.union());

app.get("/", (req: express.Request, res: express.Response) => {
  res.render("index", { user: req.session.user });
});

app.get("/problems", (req: express.Request, res: express.Response) => {
  let user_permission = req.session.user?.permission;
  user_permission = user_permission ? user_permission : 0;
  let problemList =
    problemManager.getProblemBriefListByPermission(user_permission);
  res.render("problems", { problems: problemList, user: req.session.user });
});

app.get("/problem/:id", (req: express.Request, res: express.Response) => {
  let id: number = parseInt(req.params.id);
  if (id === NaN) {
    res.render("error", {
      message: "Invalid problem id",
      user: req.session.user,
    });
    return;
  }
  let problem = problemManager.getProblem(id);
  if (problem.empty) {
    res.render("error", {
      message: "Problem not found",
      user: req.session.user,
    });
    return;
  }
  let user_permission = req.session.user?.permission;
  user_permission = user_permission ? user_permission : 0;
  if (problem.permission > user_permission) {
    res.render("error", {
      message: "You do not have permission to view this problem",
      user: req.session.user,
    });
    return;
  }
  res.render("problem", { problem: problem, user: req.session.user });
  return;
});


app.get(
  "/submissions",
  async (req: express.Request, res: express.Response) => {
    let user = req.session.user;
    if(!user) {
      res.render("error", {
        message: "You are not logged in",
        user: user
      });
      return;
    }
    let submissions = await submissionManager.getSubmissionsByUserId(user.id);
    let problems = new Array<ProblemBrief>();
    submissions.forEach(submission => {
      let problem = problemManager.getProblem(submission.problem_id);
      problems.push(problem.getBrief());
    });
    res.render("submissions", { submissions: submissions, problems: problems, user: user, Status: SubmissionStatus, Color: submissionStatusColor });
  }
);


app.get(
  "/submission/:id",
  async (req: express.Request, res: express.Response) => {
    let id: number = parseInt(req.params.id);
    if (id === NaN) {
      res.render("error", {
        message: "Invalid submission id",
        user: req.session.user,
      });
      return;
    }
    let submission = await submissionManager.getSubmissionById(id);
    if (!submission) {
      res.render("error", {
        message: "Submission not found",
        user: req.session.user,
      });
      return;
    }
    // TODO: check permission
    res.render("submission", {
      submission: submission,
      user: req.session.user,
      SubmissionStatus: SubmissionStatus,
      color: submissionStatusColor
    });
    return;
  }
);

// API
app.get(
  "/api/problem_content/:id",
  (req: express.Request, res: express.Response) => {
    let id: number = parseInt(req.params.id);
    if (id === NaN) {
      res.json({ success: false });
      return;
    }
    let problem = problemManager.getProblem(id);
    if (problem.empty) {
      res.json({ success: false });
      return;
    }
    let user_permission = req.session.user?.permission;
    user_permission = user_permission ? user_permission : 0;
    if (problem.permission > user_permission) {
      res.json({ success: false });
      return;
    }
    res.json({ success: true, data: problem.description });
    return;
  }
);

app.post("/api/submit", async (req: express.Request, res: express.Response) => {
  let user = req.session.user;
  if (!user) {
    res.json({ success: false, message: "Not logged in" });
    return;
  }
  let problem_id = parseInt(req.body.problem_id);
  if (!problem_id) {
    res.json({ success: false, message: "Invalid problem id" });
    return;
  }
  let problem = problemManager.getProblem(problem_id);
  if (problem.empty) {
    res.json({ success: false, message: "Problem not found" });
    return;
  }
  let user_permission = user.permission;
  user_permission = user_permission ? user_permission : 0;
  if (problem.permission > user_permission) {
    res.json({
      success: false,
      message: "You do not have permission to submit",
    });
    return;
  }
  let codeStream: fs.ReadStream = req.body.code;
  let code = await readStream(codeStream);
  if (code.length < 1) {
    res.json({ success: false, message: "Empty code" });
    return;
  }
  // let language = req.body.language; TODO
  let language = Language.cpp;
  let submissionId = -1;
  try {
    submissionId = await submissionManager.addSubmission(
      problem_id,
      user.id,
      language,
      { code: code }
    );
    res.json({ success: true, url: `/submission/${submissionId}` });
  } catch (e) {
    let message = "";
    if (e instanceof Error) {
      message = e.message;
    } else {
      console.log(`Unknown error: ${e}`);
      message = "Unknown Error ${e}";
    }
    if (submissionId != -1) {
      await submissionManager.setSubmissionFailStatus(
        submissionId,
        SubmissionStatus.UE,
        { code: code, error: message }
      );
    }
    if (e instanceof FailSubmission) {
      res.json({ success: false, message: e.message });
    } else {
      console.log(e);
      res.json({ success: false, message: "Unknown error" });
    }
  }
  try {
    await judger.judge(user, problem, language, code, submissionId);
  } catch (e) {
    let message = "";
    if (e instanceof Error) {
      message = e.message;
    } else {
      message = "Unknown Error ${e}";
    }
    console.log(`Judge Error: ${message}`);
    if (submissionId != -1) {
      await submissionManager.setSubmissionFailStatus(
        submissionId,
        SubmissionStatus.UE,
        { code: code, error: message }
      );
    }
  }
  return;
});

app.post("/login", async (req: express.Request, res: express.Response) => {
  let username: string = req.body.username;
  let password: string = req.body.password;
  if (!username || !password) {
    console.log("Invalid login");
    res.json({ success: false, message: "Invalid username or password" });
    return;
  }
  let user = await userManager.getUserByUsername(username);
  if (!user) {
    console.log("Invalid username");
    res.json({ success: false, message: "Invalid username" });
    return;
  }
  if (user.password !== password) {
    console.log("Invalid password");
    res.json({ success: false, message: "Wrong password" });
    return;
  }
  console.log(`User ${username} logged in`);
  req.session.user = user;
  res.json({ success: true });
  return;
});

app.get("/logout", (req: express.Request, res: express.Response) => {
  let user = req.session.user;
  if (!user) {
    return res.json({ success: false, message: "Not logged in" });
  }
  req.session.user = undefined;
  let username = user.username;
  req.session.destroy((err) => {
    if (err) {
      console.log(err);
      return;
    }
    console.log(`User ${username} logged out`);
  });
  res.redirect("/");
  return;
});

// Error Handler

app.get("/*", (req: express.Request, res: express.Response) => {
  res.render("error", { message: "Page not found", user: req.session.user });
});

app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    res.render("error", { message: err.message, user: req.session.user });
  }
);

let port = 80;

// Start server
app.listen(port, () => {
  console.log(`Example app listening on port ${port}!`);
});