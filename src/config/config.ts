import fs from 'fs';

class Config {
	configFile: string;
	secret: string;
	db: DBConfig;
	judger: JudgerConfig;
	constructor(configFile: string) {
		this.configFile = configFile;
		let data = JSON.parse(fs.readFileSync(configFile, 'utf8'));

		this.secret = data.secret;

		this.db = new DBConfig(data.db);
		this.judger = new JudgerConfig(data.judger);
	}
}

class DBConfig {
	host: string;
	port: number;
	user: string;
	password: string;
	database: string;
	constructor(data: any) {
		this.host = data.host;
		this.port = data.port;
		this.user = data.user;
		this.password = data.password;
		this.database = data.database;
	}
}

class CompilerConfig {
	name: string;
	args: string[];
	constructor(data: any) {
		this.name = data.name;
		this.args = data.args;
	}
}

class JudgerConfig {
	workspace: string;
	compilers: { [key: string]: CompilerConfig };
	args: string[];
	constructor(data: any) {
		this.workspace = data.workspace;
		this.args = data.args;
		this.compilers = {};
		for(let i=0; i<data.compilers.length; i++) {
			this.compilers[data.compilers[i].name] = new CompilerConfig(data.compilers[i]);
		}
	}
}

let configFile = 'config.json';

let config: Config = new Config(configFile);

export default config;