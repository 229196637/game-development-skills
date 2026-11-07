import { apply as install, inject } from './plugin.js';
import { registerQueries } from './queries.js';

export { inject };
export function apply(ctx, config = {}) { return install(ctx, config, registerQueries); }
