import express from "express";
import config from "./config/config";
import problemManager from "./problems/problem";
import { User, userManager } from "./user/user";
import * as session from "express-session";
import expressMySqlSession from "express-mysql-session";

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

app.get("/", (req: express.Request, res: express.Response) => {
  res.render("index", { user: req.session.user });
});

app.get("/problems", (req: express.Request, res: express.Response) => {
  let user_permission = req.session.user?.permission;
  user_permission = user_permission ? user_permission : 0;
  let problemList = problemManager.getProblemBriefListByPermission(user_permission);
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

app.post("/login", (req: express.Request, res: express.Response) => {
  let username: string = req.body.username;
  let password: string = req.body.password;
  if (!username || !password) {
    console.log("Invalid login");
    res.json({ success: false, message: "Invalid username or password" });
    return;
  }
  let user = userManager.getUserByUsername(username, (user: User | null) => {
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
  });
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

// Start server
app.listen(3000, () => {
  console.log("Example app listening on port 3000!");
});
