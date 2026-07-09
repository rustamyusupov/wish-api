import { z } from 'zod';

const PARSE_TIMEOUT_MS = 90_000;

const parseResult = z.looseObject({
	available: z.boolean(),
	amount: z.number().optional(),
	currencyCode: z.string().optional(),
	name: z.string().optional()
});

export type ParseResult = z.infer<typeof parseResult>;

export class ParserError extends Error {
	status: number;

	constructor(status: number, message: string) {
		super(message);
		this.name = 'ParserError';
		this.status = status;
	}
}

export const parseLink = async (parserUrl: string, link: string): Promise<ParseResult> => {
	const response = await fetch(`${parserUrl}/parse`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ url: link }),
		signal: AbortSignal.timeout(PARSE_TIMEOUT_MS)
	});
	if (!response.ok) {
		const message = await response
			.json()
			.then((body) => (body as { message?: string }).message)
			.catch(() => undefined);
		throw new ParserError(response.status, message ?? `parser responded ${response.status}`);
	}

	return parseResult.parse(await response.json());
};
