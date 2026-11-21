import { loadDataset } from '../src/datasource.js';
import { createServer } from '../src/server.js';

export const dataset = loadDataset();

export const TEST_TOKEN = 'test-token';

export function plain(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

export async function startInProcessServer() {
  const server = createServer({ dataset, tokens: [TEST_TOKEN] });
  await server.start();

  return {
    async query(query, variables) {
      const response = await server.executeOperation(
        { query, variables },
        { contextValue: { dataset, auth: { token: TEST_TOKEN } } },
      );

      if (response.body.kind !== 'single') {
        throw new Error('Batch operations are not used in these tests');
      }
      const result = response.body.singleResult;
      if (result.data) {
        result.data = plain(result.data);
      }
      return result;
    },
    start: () => server.start(),
    stop: () => server.stop(),
  };
}
