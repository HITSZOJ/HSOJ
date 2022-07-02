import path from 'path';
import fs from 'fs/promises';
import { exec, ChildProcess } from 'child_process';
import config from '../config/config';

import {Submission, FailSubmission, submissionManager, Language, SubmissionStatus} from '../submission/submission';
import {Problem, problemManager} from '../problem/problem';

import db from '../adatabase/database';
import { User } from '../user/user';
import {readStream, execFinish} from '../utils/utils';

import * as Diff from 'diff';

interface Compiler {
	compile(name: string, code: string): Promise<void>;
}

class CompileError extends Error {
	constructor(message: string) {
		super(message);
	}
}

class CppCompiler implements Compiler {
	name: string = "c++";
	cmd: string;
	constructor() {
		// TODO: use yaoj-judger to compile
		this.cmd = config.judger.compilers[this.name].args.join(' ');
	}
	async compile(name: string, code: string): Promise<void> {
		await fs.writeFile(`${name}.cpp`, code);
		let cmd = this.cmd.replaceAll('${name}', name);
		console.log(`Compiling: ${cmd}`);

		let result = await execFinish(cmd);
		// let process = await exec(`${cmd}`);

		// let result = await new Promise<ChildProcess>((resolve, reject) => {
		// 	process.on('exit', (code, signal) => {
		// 		resolve(process);
		// 	});
		// 	process.on('error', (err) => {
		// 		resolve(process);
		// 	});
		// });

		if(result.exit_code !== 0) {
			throw new CompileError(`Compile error: ${result.stdout} ${result.stderr}`);
		}
		return;
	}
}

export class JudgeResult {
	status: SubmissionStatus;
	signal: number;
	exit_code: number;
	real_time: number;
	cpu_time: number;
	memory: number;
	parseStatus(status: number): SubmissionStatus {
		switch (status) {
			case 0:
				return SubmissionStatus.AC;
			case 1:
				return SubmissionStatus.RE;
			case 2:
				return SubmissionStatus.MLE;
			case 3:
				return SubmissionStatus.TLE;
			case 4:
				return SubmissionStatus.OLE;
			case 5:
				return SubmissionStatus.JE; // system error -> judger error
			case 6:
				return SubmissionStatus.RE; // dangerous system call -> runtime error
			case 7:
				return SubmissionStatus.RE; // exit code error -> runtime error
			default:
				return SubmissionStatus.UE;
		}
	}
	constructor(data: any) {
		this.status = this.parseStatus(data.result)
		this.signal = data.signal;
		this.exit_code = data.exit_code;
		this.real_time = data.real_time;
		this.cpu_time = data.cpu_time;
		this.memory = data.memory;
	}
}

class Judger {
	cppCompiler: CppCompiler;
	cmd: string;
	constructor() {
		this.cppCompiler = new CppCompiler();
		this.cmd = config.judger.args.join(' ');
	}
	getCompiler(language: Language): Compiler {
		if(language === Language.cpp) {
			return this.cppCompiler;
		}
		throw new CompileError(`Unsupported language: ${Language[language]}`);
	}

	private async singleJudge(problem: Problem, language: Language, code: string, cmd: string, targetPrefix: string, index: number): Promise<JudgeResult> {
		let input = path.join(problemManager.src_list[problem.id], `${problem.judge.prefix}${index}.in`);
		let output = `${targetPrefix}.out`;
		let ans = path.join(problemManager.src_list[problem.id], `${problem.judge.prefix}${index}.ans`);
		// let log = `${targetPrefix}.log`;
		let final_cmd = cmd.replace('${input}', input).replace('${output}', output);
		console.log(`Running: ${final_cmd}`);
		// let process = await exec(final_cmd);
		let result = await execFinish(final_cmd);

		// let stdout_string = '';
		// process.stdout?.on('data', (data) => {
		// 	stdout_string += data;
		// });
		// let result = await new Promise<ChildProcess>((resolve, reject) => {
		// 	process.on('exit', (code, signal) => {
		// 		resolve(process);
		// 	});
		// 	process.on('error', (err) => {
		// 		resolve(process);
		// 	});
		// });


		if(result.exit_code !== 0) {
			throw new Error(`Judger Run Error ${result.stdout} ${result.stderr}`);
		}
		// let log_res = await fs.readFile(log, 'utf8');
		// let re = /result: \S+\"(\S+)\"\S+real_time/;
		// let match = re.exec(log_res);
		// if(match === null) {
		// 	throw new Error("judge result not matched");
		// }
		// let status_string = match[0];
		if(!result.stdout) {
			throw new Error("judge result not found");
		}
		let judge_result_json = JSON.parse(result.stdout);
		let judge_result = new JudgeResult(judge_result_json);
		if(judge_result.status !== SubmissionStatus.AC) {
			return judge_result;
		}

		let output_text = (await fs.readFile(output, 'utf8')).trim();
		let ans_text = (await fs.readFile(ans, 'utf8')).trim();
		let diff_result = Diff.diffTrimmedLines(ans_text, output_text);
		let flag: boolean = false;
		for(let item of diff_result) {
			if(item.added || item.removed) {
				flag = true;
				break;
			}
		}
		if(flag) {
			judge_result.status = SubmissionStatus.WA;
		}
		return judge_result;
	}
	async judge(user: User, problem: Problem, language: Language, code: string, submissionId: number): Promise<void> {
		let targetPrefix = path.join(config.judger.workspace, submissionId.toString());
		try {
			let compiler = this.getCompiler(language);
			await this.cppCompiler.compile(targetPrefix, code);
		} catch(e) {
			if(e instanceof CompileError) {
				await submissionManager.setSubmissionFailStatus(submissionId, SubmissionStatus.CE, {
					code: code,
					error: e.message,
				});
				return;
			} else {
				throw e;
			}
		}
		let cmd = this.cmd
			.replaceAll('${name}', targetPrefix)
			.replace('${time_limit}', problem.time_limit.toString())
			.replace('${memory_limit}', problem.memory_limit.toString())
			.replace('${output_limit}', "64"); // TODO: use problem.output_limit
		let testcase = problem.judge.testcase;
		let ac_counts = 0;
		let status = SubmissionStatus.AC;
		let results = new Array<JudgeResult>();
		for(let i=0; i<testcase; ++i) {
			let result = await this.singleJudge(problem, language, code, cmd, targetPrefix, i);
			if(result.status == SubmissionStatus.AC) {
				++ac_counts;
			}
			status = Math.max(status, result.status); // get the most serious status
			results.push(result);
		}
		let score = testcase ? Math.floor(ac_counts / testcase * 100) : 100;
		// TODO: calculate average time, memory, etc.
		await submissionManager.updateSubmissionStatus(submissionId, status);
		await submissionManager.updateSubmissionScore(submissionId, score);
		await submissionManager.updateSubmissionDetail(submissionId, {
			code: code,
			results: results
		});
		return;
	}
}

export let judger: Judger = new Judger();

export default judger;