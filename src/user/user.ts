import config from '../config/config';
import db from '../database/database';
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
	getUserById(id: number, callback: (user: User | null) => void): void {
		if(id === NaN) {
			return;
		}
		db.query('SELECT * FROM users WHERE id = ?', [id], (err, results) => {
			if(err) {
				console.log(err);
				callback(null);
				return;
			}
			if(results.length === 0) {
				callback(null);
				return;
			}
			let user = new User(results[0].id, results[0].username, results[0].password, results[0].email, results[0].permission);
			callback(user);
			return;
		});
		return;
	}
	getUserByUsername(username: string, callback: (user: User | null) => void): void {
		db.query('SELECT * FROM users WHERE username = ?', [username], (err, results) => {
			if(err) {
				console.log(err);
				callback(null);
				return;
			}
			if(results.length === 0) {
				callback(null);
				return;
			}
			let user = new User(results[0].id, results[0].username, results[0].password, results[0].email, results[0].permission);
			callback(user);
			return;
		});
		return;
	}
}

export let userManager = new UserManager();