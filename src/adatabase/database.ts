import mysql from 'mysql2/promise';
import config from '../config/config';

const configDB = {
	host: config.db.host,
	port: config.db.port,
	user: config.db.user,
	password: config.db.password,
	database: config.db.database
};

// type asyncDB = {
// 	query: ( sql, args ) => Promise<unknown>,
// 	close: () => Promise<unknown>
// }

// const connection: mysql.Connection = mysql.createConnection({
// 	host: config.db.host,
// 	port: config.db.port,
// 	user: config.db.user,
// 	password: config.db.password,
// 	database: config.db.database
// });

// function makeDb( config: typeof configDB ): asyncDB {
// 	const connection = mysql.createConnection( config );
// 	return {
// 	  query( sql, args ) {
// 		return util.promisify( connection.query )
// 		  .call( connection, sql);
// 	  },
// 	  close() {
// 		return util.promisify( connection.end ).call( connection );
// 	  }
// 	};
//   }

class Database {
	pool: mysql.Pool;
	constructor() {
		this.pool = mysql.createPool(configDB);
	}
	async query(sql: string, args: any[]): Promise<any> {
		return await this.pool.query(sql, args);
	}

	async close() {
		return await this.pool.end();
	}
}

export default new Database();