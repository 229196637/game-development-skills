import { readFile } from 'node:fs/promises';
export async function clientSource() {
  const source = await readFile(new URL('../src/client/index.js', import.meta.url), 'utf8');
  const shared = await readFile(new URL('../src/shared/remotes.js', import.meta.url), 'utf8');
  const marker = '/* SHARED_REMOTE_DESCRIPTORS */';
  if (source.split(marker).length !== 2) throw new Error('Expected one shared remote descriptor placeholder');
  return source.replace(marker, shared.replace('export function createDescriptors', 'function createDescriptors'));
}
