import {
	generateAuthenticationOptions,
	generateRegistrationOptions,
	verifyAuthenticationResponse,
	verifyRegistrationResponse
} from '@simplewebauthn/server';
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server';
import { eq } from 'drizzle-orm';
import type { FastifyReply } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { credentials } from '../../db/schema.ts';
import type { AuthConfig } from '../../plugins/auth.ts';
import {
	CHALLENGE_COOKIE,
	CHALLENGE_MAX_AGE,
	createSessionToken,
	getCredential,
	hasCredentials,
	SESSION_COOKIE,
	SESSION_MAX_AGE
} from '../../services/auth.ts';
import { loginBody, okResponse, registerBody, sessionInfo } from './schemas.ts';

const setChallenge = (reply: FastifyReply, challenge: string, config: AuthConfig) => {
	reply.setCookie(CHALLENGE_COOKIE, challenge, {
		path: '/',
		maxAge: CHALLENGE_MAX_AGE,
		httpOnly: true,
		sameSite: 'lax',
		secure: config.secure
	});
};

const startSession = (reply: FastifyReply, config: AuthConfig) => {
	reply.clearCookie(CHALLENGE_COOKIE, { path: '/' });
	reply.setCookie(SESSION_COOKIE, createSessionToken(config.secret), {
		path: '/',
		maxAge: SESSION_MAX_AGE,
		httpOnly: true,
		sameSite: 'lax',
		secure: config.secure
	});
};

const routes: FastifyPluginAsyncZod = async (app) => {
	app.post('/register', { schema: { body: registerBody } }, async (request, reply) => {
		const config = app.authConfig;
		const body = request.body;

		const setupAllowed =
			!hasCredentials(app.db) &&
			config.setupToken !== undefined &&
			body.token === config.setupToken;
		if (!request.authenticated && !setupAllowed) {
			reply.code(403);
			return { message: 'Registration is closed' };
		}

		if (!body.response) {
			const registered = app.db.select({ id: credentials.id }).from(credentials).all();
			const options = await generateRegistrationOptions({
				rpName: 'Wishlist',
				rpID: config.rpId,
				userName: 'owner',
				attestationType: 'none',
				excludeCredentials: registered,
				authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' }
			});
			setChallenge(reply, options.challenge, config);
			return options;
		}

		const expectedChallenge = request.cookies[CHALLENGE_COOKIE];
		if (!expectedChallenge) {
			reply.code(400);
			return { message: 'Challenge expired, try again' };
		}

		const { verified, registrationInfo } = await verifyRegistrationResponse({
			response: body.response as unknown as RegistrationResponseJSON,
			expectedChallenge,
			expectedOrigin: config.origin,
			expectedRPID: config.rpId,
			requireUserVerification: false
		});
		if (!verified || !registrationInfo) {
			reply.code(400);
			return { message: 'Passkey verification failed' };
		}

		const { credential } = registrationInfo;
		app.db
			.insert(credentials)
			.values({
				id: credential.id,
				publicKey: Buffer.from(credential.publicKey),
				counter: credential.counter,
				transports: credential.transports ? JSON.stringify(credential.transports) : null
			})
			.run();

		startSession(reply, config);
		return { ok: true };
	});

	app.post('/login', { schema: { body: loginBody } }, async (request, reply) => {
		const config = app.authConfig;
		const body = request.body;

		if (!body.response) {
			const options = await generateAuthenticationOptions({
				rpID: config.rpId,
				userVerification: 'preferred'
			});
			setChallenge(reply, options.challenge, config);
			return options;
		}

		const expectedChallenge = request.cookies[CHALLENGE_COOKIE];
		if (!expectedChallenge) {
			reply.code(400);
			return { message: 'Challenge expired, try again' };
		}

		const credential = body.id ? getCredential(app.db, body.id) : undefined;
		if (!credential) {
			reply.code(400);
			return { message: 'Unknown passkey' };
		}

		const { verified, authenticationInfo } = await verifyAuthenticationResponse({
			response: body as unknown as AuthenticationResponseJSON,
			expectedChallenge,
			expectedOrigin: config.origin,
			expectedRPID: config.rpId,
			requireUserVerification: false,
			credential: {
				id: credential.id,
				publicKey: new Uint8Array(credential.publicKey),
				counter: credential.counter,
				transports: credential.transports ? JSON.parse(credential.transports) : undefined
			}
		});
		if (!verified) {
			reply.code(400);
			return { message: 'Passkey verification failed' };
		}

		app.db
			.update(credentials)
			.set({ counter: authenticationInfo.newCounter })
			.where(eq(credentials.id, credential.id))
			.run();

		startSession(reply, config);
		return { ok: true };
	});

	app.post('/logout', { schema: { response: { 200: okResponse } } }, (request, reply) => {
		reply.clearCookie(SESSION_COOKIE, { path: '/' });
		return { ok: true as const };
	});

	app.get('/session', { schema: { response: { 200: sessionInfo } } }, (request) => ({
		authenticated: request.authenticated,
		needsSetup: !hasCredentials(app.db)
	}));
};

export default routes;
