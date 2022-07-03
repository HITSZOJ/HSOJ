import { ResultSetHeader } from 'mysql2';
import db from '../adatabase/database';
import { JudgeResult } from '../judger/judger'

export enum Language {
	c = 0,
	cpp = 1,
	java = 2,
	python = 3,
	csharp = 4,
	javascript = 5,
	typescript = 6,
	ruby = 7,
	go = 8,
	rust = 9,
	kotlin = 10,
	swift = 11,
	php = 12,
	haskell = 13,
	lua = 14,
	scala = 15,
	d = 16,
	r = 17,
	awk = 18,
	perl = 19,
	go_go = 20,
}

export enum SubmissionStatus {
	AC = 0,
	WA = 1,
	TLE = 2,
	MLE = 3,
	OLE = 4,
	RE = 5,
	CE = 6,
	JE = 7, // system error & judger error
	UE = 8,
	Pending = 233,
}

class SubmissionDetail {
	error: string;
	code: string;
	results: Array<JudgeResult>;
	constructor(data: any) {
		this.error = data.error || '';
		this.code = data.code || '';
		this.results = data.results || [];
	}
}

export class Submission {
	id: number;
	problem_id: number;
	user_id: number;
	language: Language;
	status: number;
	score: number;
	time: Date;
	detail: SubmissionDetail;
	constructor(id: number, problem_id: number, user_id: number, language: number | Language, status: number | SubmissionStatus, score: number, time: Date, detail: SubmissionDetail) {
		this.id = id;
		this.problem_id = problem_id;
		this.user_id = user_id;
		this.language = language;
		this.status = status;
		this.score = score;
		this.time = time;
		this.detail = detail;
	}
}

export class FailSubmission extends Error {
	constructor(message: string) {
		super(message);
	}
}

class SubmissionManager {
	constructor() {
	}
	async getSubmissionById(id: number): Promise<Submission|null> {
		let res = (await db.query(`SELECT * FROM submissions WHERE id = ?`, [id]))[0];
		if(!res || res.length == 0) {
			return null;
		}
		return new Submission(res[0].id, res[0].problem_id, res[0].user_id, res[0].language, res[0].status, res[0].score, res[0].time, new SubmissionDetail(res[0].detail));
	}
	async addSubmission(problem_id: number, user_id: number, language: Language, detail: object): Promise<number> {
		let res: ResultSetHeader = (await db.query(`INSERT INTO submissions (user_id, problem_id, language, status, score,    time, detail) VALUES (?, ?, ?, ?, ?, now(), ?)`,
														   [user_id, problem_id, language,     233,     0, JSON.stringify(detail)]))[0];
		if(!res) {
			throw new FailSubmission("Failed to add submission");
		}
		if(res.affectedRows !== 1) {
			throw new FailSubmission(`Failed to add submission. ${res.info}`);
		}
		return res.insertId;
	}
	private async updateSubmission(id: number, columnName: string, value: any): Promise<void> {
		let res: ResultSetHeader = (await db.query(`UPDATE submissions SET ${columnName} = ? WHERE id = ?`, [value, id]))[0];
		if(!res) {
			throw new FailSubmission("Failed to update submission");
		}
		if(res.affectedRows !== 1) {
			throw new FailSubmission(`Failed to update submission. ${res.info}`);
		}
		return;
	}
	async updateSubmissionStatus(id: number, status: SubmissionStatus): Promise<void> {
		await this.updateSubmission(id, "status", status);
	}
	async updateSubmissionScore(id: number, score: number): Promise<void> {
		await this.updateSubmission(id, "score", score);
	}
	async updateSubmissionDetail(id: number, detail: object): Promise<void> {
		await this.updateSubmission(id, "detail", JSON.stringify(detail));
	}
	async setSubmissionFailStatus(id: number, status: SubmissionStatus, detail: object): Promise<void> {
		await this.updateSubmissionStatus(id, status);
		await this.updateSubmissionScore(id, 0);
		await this.updateSubmissionDetail(id, detail);
		return;
	}

	async getSubmissionsByUserId(user_id: number): Promise<Array<Submission>> {
		let res = (await db.query(`SELECT * FROM submissions WHERE user_id = ? ORDER BY time DESC`, [user_id]))[0];
		if(!res || res.length == 0) {
			return [];
		}
		let submissions: Array<Submission> = [];
		for(let i = 0; i < res.length; i++) {
			submissions.push(new Submission(res[i].id, res[i].problem_id, res[i].user_id, res[i].language, res[i].status, res[i].score, res[i].time, new SubmissionDetail(res[i].detail)));
		}
		return submissions;
	}

}

export let submissionManager = new SubmissionManager();
export default submissionManager;