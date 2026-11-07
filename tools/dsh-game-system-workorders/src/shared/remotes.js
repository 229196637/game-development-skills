/** Strict, dependency-free Typert codecs shared verbatim by Host and Client. */
export function createDescriptors() {
  const owner = '@local/dsh-game-system-workorders';
  const string = value => {
    if (typeof value !== 'string' || !value.length || value.length > 32768) throw new Error('Expected a nonempty string of at most 32768 characters');
    return value;
  };
  const options = value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected query options');
    for (const key of Object.keys(value)) {
      if (!['directory', 'query', 'includeCompleted'].includes(key)) throw new Error(`Unknown query option: ${key}`);
      if (key === 'includeCompleted' ? typeof value[key] !== 'boolean' : typeof value[key] !== 'string' || value[key].length > 32768) throw new Error(`Invalid query option: ${key}`);
    }
    return value;
  };
  const codec = (symbol, parse) => ({ mode: 'strict', typeSymbol: symbol, create: () => ({ parse }) });
  const agent = { name: 'agent', wire: 'agentId', source: 'lookup', lookup: 'agent', codec: codec('@deepseek-ai/dsh-session/types#SessionId', string) };
  const json = (name, parse) => ({ name, wire: name, source: 'json', codec: codec(`${owner}#${name}`, parse) });
  const result = codec(`${owner}#ReadResult`, value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected a workorder result object');
    return value;
  });
  const make = (method, parameters) => ({ id: `${owner}#gameWorkorders/${method}`, service: 'gameWorkorders', namespace: 'gameWorkorders', method, invocation: { kind: 'direct' }, parameters: [agent, ...parameters], cancellation: { parameter: 'signal' }, result });
  return [make('discover', [json('options', options)]), make('snapshot', [json('root', string)]), make('document', [json('root', string), json('file', string)]), make('evidence', [json('root', string), json('taskId', string)]), make('resolveEvidence', [json('root', string), json('taskId', string), json('evidenceId', string)])];
}
