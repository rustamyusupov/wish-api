import { defineConfig } from 'drizzle-kit';

try {
	process.loadEnvFile();
} catch {
	// no .env file
}

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

export default defineConfig({
	schema: './src/db/schema.ts',
	out: './src/db/migrations',
	dialect: 'sqlite',
	dbCredentials: { url: process.env.DATABASE_URL },
	verbose: true,
	strict: true
});
