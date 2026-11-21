import { startStandaloneServer } from '@apollo/server/standalone';
import { resolveAuthTokens } from './auth.js';
import { loadDataset } from './datasource.js';
import { createContext, createServer } from './server.js';

const PORT = Number(process.env.PORT ?? 4000);
const HOST = process.env.HOST ?? '0.0.0.0';

const dataset = loadDataset();
const tokens = resolveAuthTokens();
const server = createServer({ dataset, tokens });

console.log('[bootstrap] dataset loaded from', dataset.dataDir);
console.log(
  '[bootstrap] nodes=%d responses=%d triggers=%d actions=%d resourceTemplates=%d',
  dataset.nodes.length,
  dataset.responses.length,
  dataset.triggers.length,
  dataset.actions.length,
  dataset.resourceTemplates.length,
);
for (const warning of dataset.warnings) {
  console.warn('[dataset warning]', warning);
}

const { url } = await startStandaloneServer(server, {
  context: createContext({ dataset, tokens }),
  listen: { port: PORT, host: HOST },
});

console.log(`[bootstrap] GraphQL API ready at ${url}`);
console.log('[bootstrap] all requests require "Authorization: Bearer <token>"');

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    console.log(`[shutdown] received ${signal}, closing server`);
    await server.stop();
    process.exit(0);
  });
}
