import fs from 'fs';

class ProblemManager {
	dir: string = './problems';
	problems: Array<Problem>;
	src_list: Array<string>;
	constructor() {
		this.problems = new Array<Problem>();
		this.src_list = new Array<string>();
		fs.readdir(this.dir, (err, files) => {
			if(err) {
				console.log(err);
				return;
			}
			for(let problem_dir of files) {
				try {
					let id = parseInt(problem_dir);
					if(id === NaN) {
						continue;
					}
					this.src_list[id] = `${this.dir}/${problem_dir}`;
				} catch(err) {
					console.log(err);
					continue;
				}
			}
		});
	}
	getProblem(id: number): Problem {
		if(id in this.src_list) {
			if(this.problems[id] == undefined) {
				let problem_dir = this.src_list[id];
				return this.problems[id] = this.loadProblem(problem_dir);
			} else {
				return this.problems[id];
			}
		} else {
			return new Problem(null);
		}
	}
	loadProblem(problem_dir: string): Problem {
		try {
			let md_file = problem_dir + '/problem.md';
			let info_file = problem_dir + '/info.json';
			let md_content = fs.readFileSync(md_file, 'utf8');
			let info = JSON.parse(fs.readFileSync(info_file, 'utf8'));
			return new Problem(
				info.id,
				info.permission,
				info.title,
				md_content,
				info.time_limit,
				info.memory_limit,
				info.difficulty,
				info.tags
			);
		} catch(err) {
			console.log(err);
			console.log('Error loading problem ' + problem_dir);
			return new Problem(null);
		}
	}
}

class Problem {
	empty: boolean = true;
	id: number;
	permission: number;
	
	title: string;
	description: string;

	time_limit: number;
	memory_limit: number;

	difficulty: number;
	tags: Array<string>;

	constructor(
		id: number | null, permission: number = 0,
		title="N/A", description="", time_limit=0, memory_limit=0, difficulty=0, tags=[]) {
		if(id == null) {
			this.empty = true;
			this.id = -1;
		} else {
			this.empty = false;
			this.id = id;
		}
		this.title = title;
		this.description = description;
		this.time_limit = time_limit;
		this.memory_limit = memory_limit;
		this.difficulty = difficulty;
		this.permission = permission;
		this.tags = tags;
	}
}

export default ProblemManager;