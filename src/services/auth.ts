import { createHmac, timingSafeEqual } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { credentials } from '../db/schema.ts';
import type { Db } from '../plugins/db.ts';

export const SESSION_COOKIE = 'session';
export const SESSION_MAX_AGE = 365 * 24 * 60 * 60;
export const CHALLENGE_COOKIE = 'challenge';
export const CHALLENGE_MAX_AGE = 5 * 60;

const sign = (payload: string, secret: string) =>
	createHmac('sha256', secret).update(payload).digest('base64url');

export const createSessionToken = (secret: string) => {
	const expires = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE;
	return `${expires}.${sign(String(expires), secret)}`;
};

export const isSessionValid = (token: string, secret: string) => {
	const [expires, signature] = token.split('.');
	if (!expires || !signature) return false;
	const expected = Buffer.from(sign(expires, secret));
	const actual = Buffer.from(signature);
	if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return false;
	return Number(expires) >= Date.now() / 1000;
};

export const isTokenValid = (token: string, expected: string) => {
	const expectedBuffer = Buffer.from(expected);
	const actualBuffer = Buffer.from(token);
	return (
		expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer)
	);
};

export const hasCredentials = (db: Db) =>
	db.select({ id: credentials.id }).from(credentials).limit(1).get() !== undefined;

export const getCredential = (db: Db, id: string) =>
	db.select().from(credentials).where(eq(credentials.id, id)).get();
