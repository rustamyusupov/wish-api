import { writeFile } from 'node:fs/promises';
import { buildApp } from '../app.ts';

const app = await buildApp();
await app.ready();
await writeFile('openapi.json', `${JSON.stringify(app.swagger(), null, '\t')}\n`);
await app.close();
