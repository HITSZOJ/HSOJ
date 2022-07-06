import config from '../config/config';
import db from '../adatabase/database';
import crypto from 'crypto';

export class User {
	id: number;
	username: string;
	password: string;
	email: string;
	permission: number;

	gravatar_hash: string;
	constructor(id: number, username: string, password: string, email: string, permission: number) {
		this.id = id;
		this.username = username;
		this.password = password;
		this.email = email;
		this.permission = permission;

		this.gravatar_hash = crypto.createHash('md5').update(email.trim().toLowerCase()).digest('hex');
		console.log(this.gravatar_hash);
	}
}

class UserManager {
	async getUserById(id: number): Promise<User | null> {
		if(id === NaN) {
			return null;
		}
		let res = (await db.query('SELECT * FROM users WHERE id = ?', [id]))[0];
		if(!res || res.length == 0) {
			return null;
		}
		return new User(res[0].id, res[0].username, res[0].password, res[0].email, res[0].permission);
	}
	async getUserByUsername(username: string): Promise<User | null> {
		if(username === '') {
			return null;
		}
		let res = (await db.query('SELECT * FROM users WHERE username = ?', [username]))[0];
		if(!res || res.length == 0) {
			return null;
		}
		return new User(res[0].id, res[0].username, res[0].password, res[0].email, res[0].permission);
	}
}

export let userManager = new UserManager();