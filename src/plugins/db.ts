import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import fp from 'fastify-plugin';
import * as schema from '../db/schema.ts';

declare module 'fastify' {
	interface FastifyInstance {
		db: ReturnType<typeof createDb>;
	}
}

const createDb = (url: string) => {
	const client = new Database(url);
	client.pragma('journal_mode = WAL');
	client.pragma('foreign_keys = ON');
	return drizzle(client, { schema });
};

export default fp(
	async (app) => {
		const url = process.env.DATABASE_URL;
		if (!url) throw new Error('DATABASE_URL is not set');

		const db = createDb(url);
		migrate(db, { migrationsFolder: path.join(import.meta.dirname, '../db/migrations') });

		app.decorate('db', db);
		app.addHook('onClose', () => {
			db.$client.close();
		});
	},
	{ name: 'db' }
);
