import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { createDescriptors } from '../shared/remotes.js';

/** No command lifecycle events, model prompts, or state mutations on this surface. */
class GameWorkordersService extends TypertRemoteService {
  constructor(ctx, operations) { super(ctx, 'gameWorkorders'); this.operations = operations; }
  discover(agent, options, signal) { return this.operations.discover(agent, options, signal); }
  snapshot(agent, root, signal) { return this.operations.snapshot(agent, root, signal); }
  document(agent, root, file, signal) { return this.operations.document(agent, root, file, signal); }
}

export function registerQueries(ctx, operations) {
  new GameWorkordersService(ctx, operations);
  ctx.typert.register({
    package: '@local/dsh-game-system-workorders', face: 'host', schemas: [],
    model: { services: [{
      key: 'gameWorkorders', exportName: 'GameWorkordersService', tags: [], types: [],
      description: 'Read-only game-system task discovery, snapshots and document previews; does not enqueue prompts or append command history.',
      members: [
        { kind: 'method', name: 'discover', signature: 'discover(agent: Agent, options: { directory?: string; query?: string; includeCompleted?: boolean }, signal: AbortSignal): Promise<Record<string, unknown>>', summary: 'Discover task roots within the current working directory.' },
        { kind: 'method', name: 'snapshot', signature: 'snapshot(agent: Agent, root: string, signal: AbortSignal): Promise<Record<string, unknown>>', summary: 'Read current task progress through the planning skill dashboard.' },
        { kind: 'method', name: 'document', signature: 'document(agent: Agent, root: string, file: string, signal: AbortSignal): Promise<Record<string, unknown>>', summary: 'Read an allowlisted entry, workorder or responsibility document.' },
      ],
    }], events: [], objects: [] },
    invocations: createDescriptors(),
  });
}
