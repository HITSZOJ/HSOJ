import fs from 'fs';
import { exec, ChildProcess } from 'child_process';

export async function readStream(stream: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolve, reject) => {
	let data = '';
	stream.on('data', (chunk) => {
	  data += chunk;
	});
	stream.on('end', () => {
	  resolve(data);
	});
	stream.on('error', (err) => {
	  reject(err);
	});
  });
}

type ExecResult = {
	process: ChildProcess;
	exit_code: number;
	stdout: string;
	stderr: string;
}

export async function execFinish(cmd: string): Promise<ExecResult> {
	let process = await exec(cmd);
	let stdout = '';
	let stderr = '';
	return new Promise((resolve, reject) => {
		process.stdout?.on('data', (chunk) => {
			stdout += chunk;
		});
		process.stderr?.on('data', (chunk) => {
			stderr += chunk;
		});
		process.on('exit', (code) => {
			resolve({
				process,
				exit_code: code===null ? -1 : code,
				stdout,
				stderr,
			});
		});
		process.on('error', (err) => {
			resolve({
				process,
				exit_code: -2,
				stdout,
				stderr,
			})
		});
	});
}

export const submissionStatusColor = {
	0: 'green', // AC
	1: 'red', // WA
	2: 'blue', // TLE
	3: 'blue', // MLE
	4: 'blue', // OLE
	5: 'purple', // RE
	6: 'yellow', // CE
	7: 'yellow', // JE
	8: 'brown', // UE
	9: 'brown', // Pending
}