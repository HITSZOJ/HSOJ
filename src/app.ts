import express from 'express';
import config from './config/config';
import ProblemManager from './problems/problem';

const app: express.Application = express();
const problemManager: ProblemManager = new ProblemManager();

app.set('view engine', 'ejs');
app.use(express.static('static'));

app.get('/', (req: express.Request, res: express.Response) => {
  res.render('index');
});

app.get('/problems', (req: express.Request, res: express.Response) => {
  res.render('problems');
});

app.get('/problem/:id', (req: express.Request, res: express.Response) => {
  let id: number = parseInt(req.params.id);
  if(id === NaN) {
    res.render('error', { message: 'Invalid problem id' });
    return;
  }
  let problem = problemManager.getProblem(id);
  if(problem.empty) {
    res.render('error', { message: 'Problem not found' });
    return;
  }
  let user_permission = 100; // TODO: get user permission
  if(problem.permission > user_permission) {
    res.render('error', { message: 'You do not have permission to view this problem' });
    return;
  }
  res.render('problem', { problem: problem });
  return;
});

// API
app.get('/api/problem_content/:id', (req: express.Request, res: express.Response) => {
  let id: number = parseInt(req.params.id);
  res.header('Content-Type', 'application/json');
  if(id === NaN) {
    res.send({ success: false });
    return;
  }
  let problem = problemManager.getProblem(id);
  if(problem.empty) {
    res.send({ success: false });
    return;
  }
  let user_permission = 100; // TODO: get user permission
  if(problem.permission > user_permission) {
    res.send({ success: false });
    return;
  }
  res.send({ success: true, data: problem.description });
  return;
});

// Error Handler

app.get('/*', (req: express.Request, res: express.Response) => {
  res.render('error', { message: 'Page not found' });
});

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  res.render('error', { message: err.message });
});

app.listen(3000, () => {
  console.log('Example app listening on port 3000!');
});