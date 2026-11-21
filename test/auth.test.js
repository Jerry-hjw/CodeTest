import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { startStandaloneServer } from '@apollo/server/standalone';
import { DEFAULT_AUTH_TOKEN, resolveAuthTokens, verifyAuthorizationHeader } from '../src/auth.js';
import { createContext, createServer } from '../src/server.js';
import { dataset, TEST_TOKEN } from './helpers.js';

const NODE_QUERY = `{ node(nodeId: "6296be3470a0c1052f89cccb") { _id name root } }`;

describe('Bearer token authentication', () => {
  it('accepts the documented token', () => {
    const verdict = verifyAuthorizationHeader(
      `Bearer ${DEFAULT_AUTH_TOKEN}`,
      resolveAuthTokens(undefined),
    );
    assert.equal(verdict.ok, true);
  });

  it('accepts a comma separated token list and ignores blank entries', () => {
    assert.deepEqual(resolveAuthTokens(' a, b ,, a '), ['a', 'b']);
  });

  it('is case tolerant about the scheme but strict about the credentials', () => {
    assert.equal(verifyAuthorizationHeader(`bearer ${TEST_TOKEN}`, [TEST_TOKEN]).ok, true);
    assert.equal(verifyAuthorizationHeader(`Bearer ${TEST_TOKEN}x`, [TEST_TOKEN]).ok, false);
  });

  it('rejects a missing header', () => {
    const verdict = verifyAuthorizationHeader(undefined, [TEST_TOKEN]);
    assert.equal(verdict.ok, false);
    assert.equal(verdict.reason, 'missing_token');
    assert.match(verdict.message, /Missing Authorization header/);
  });

  it('rejects a header without the Bearer scheme', () => {
    const verdict = verifyAuthorizationHeader(`Basic ${Buffer.from('user:pass').toString('base64')}`, [
      TEST_TOKEN,
    ]);
    assert.equal(verdict.ok, false);
    assert.match(verdict.message, /Unsupported authorization scheme/);
  });

  it('rejects a header that only contains the scheme', () => {
    const verdict = verifyAuthorizationHeader('Bearer', [TEST_TOKEN]);
    assert.equal(verdict.ok, false);
    assert.match(verdict.message, /Malformed Authorization header/);
  });
});

describe('HTTP transport', () => {
  let server;
  let url;

  before(async () => {
    const tokens = [...resolveAuthTokens(), TEST_TOKEN];
    server = createServer({ dataset, tokens });
    ({ url } = await startStandaloneServer(server, {
      context: createContext({ dataset, tokens }),
      listen: { port: 0, host: '127.0.0.1' },
    }));
  });

  after(async () => {
    await server.stop();
  });

  const post = (body, headers = {}) =>
    fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });

  it('rejects a request without a token with HTTP 401', async () => {
    const response = await post({ query: NODE_QUERY });
    assert.equal(response.status, 401);
    const body = await response.json();
    assert.equal(body.data ?? null, null);
    assert.equal(body.errors[0].extensions.code, 'UNAUTHENTICATED');
  });

  it('rejects an invalid token with HTTP 401', async () => {
    const response = await post({ query: NODE_QUERY }, { authorization: 'Bearer wrong-token' });
    assert.equal(response.status, 401);
    const body = await response.json();
    assert.equal(body.errors[0].extensions.code, 'UNAUTHENTICATED');
  });

  it('serves data for a valid token', async () => {
    const response = await post({ query: NODE_QUERY }, { authorization: `Bearer ${TEST_TOKEN}` });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.errors, undefined);
    assert.deepEqual(body.data.node, {
      _id: '6296be3470a0c1052f89cccb',
      name: 'Greeting Message',
      root: true,
    });
  });

  it('supports GraphQL variables and the documented default token', async () => {
    const response = await post(
      {
        query: 'query Node($nodeId: ID) { node(nodeId: $nodeId) { name parentIds } }',
        variables: { nodeId: '62971a9570a0c12bb389cd13' },
      },
      { authorization: `Bearer ${DEFAULT_AUTH_TOKEN}` },
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.data.node, { name: '10AM Timeslot', parentIds: ['XTpR0HkNpxWjJ6eG'] });
  });
});
