import { z } from 'zod';

export const category = z.object({
	id: z.number().int(),
	name: z.string()
});
