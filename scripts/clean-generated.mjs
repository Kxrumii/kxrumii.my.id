import { rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const generatedDirectories = [
  new URL('../public/tugas/', import.meta.url),
  new URL('../dist/', import.meta.url),
];

for (const directory of generatedDirectories) {
  await rm(fileURLToPath(directory), { recursive: true, force: true });
}

console.log('Generated task output and previous site build removed.');
