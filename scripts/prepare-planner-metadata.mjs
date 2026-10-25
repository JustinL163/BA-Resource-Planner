import { mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generatePlannerMetadata } from './planner-metadata.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
await mkdir(join(root, '.generated-content'), { recursive: true });
await generatePlannerMetadata(root, join(root, '.generated-content', 'planner.ts'));
