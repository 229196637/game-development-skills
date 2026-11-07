import { readFile } from 'node:fs/promises';
export async function clientSource() {
  const source = await readFile(new URL('../src/client/index.js', import.meta.url), 'utf8');
  const shared = await readFile(new URL('../src/shared/remotes.js', import.meta.url), 'utf8');
  const marker = '/* SHARED_REMOTE_DESCRIPTORS */';
  if (source.split(marker).length !== 2) throw new Error('Expected one shared remote descriptor placeholder');
  const media = await readFile(new URL('../src/client/media.js', import.meta.url), 'utf8');
  const seat = await readFile(new URL('../src/client/seat.js', import.meta.url), 'utf8');
  const graph = await readFile(new URL('../src/client/graph.js', import.meta.url), 'utf8');
  const graphView = await readFile(new URL('../src/client/graph-view.js', import.meta.url), 'utf8');
  const workbench = await readFile(new URL('../src/client/workbench.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../src/client/workbench.css', import.meta.url), 'utf8');
  return source.replace(marker, shared.replace('export function createDescriptors', 'function createDescriptors'))
    .replace('/* WORKBENCH_COMPONENTS */', `${graph.replace(/^export /gm, '')}\n${graphView.replace(/^export /gm, '')}\n${media.replace('export function createThumbnailPool', 'function createThumbnailPool')}\n${seat.replace('export function seatOf', 'function seatOf')}\n${workbench.replace('export function createWorkbench', 'function createWorkbench')}`)
    .replace('/* WORKBENCH_CSS */', JSON.stringify(css));
}
