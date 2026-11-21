import { createHash, timingSafeEqual } from 'node:crypto';

export const DEFAULT_AUTH_TOKEN = 'ct_graphql_9f4b2c7d1e6a8b3f5c0d2e4a6b8c1d3e';

export const AUTH_SCHEME = 'Bearer';

export function resolveAuthTokens(rawValue = process.env.AUTH_TOKEN) {
  const source = rawValue == null || rawValue.trim() === '' ? DEFAULT_AUTH_TOKEN : rawValue;
  const tokens = source
    .split(',')
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
  return [...new Set(tokens)];
}

export function extractBearerToken(headerValue) {
  if (headerValue == null || String(headerValue).trim() === '') {
    return { error: 'Missing Authorization header. Expected "Authorization: Bearer <token>".' };
  }

  const value = String(headerValue).trim();
  const separatorIndex = value.indexOf(' ');

  if (separatorIndex === -1) {
    return { error: `Malformed Authorization header. Expected "${AUTH_SCHEME} <token>".` };
  }

  const scheme = value.slice(0, separatorIndex);
  const credentials = value.slice(separatorIndex + 1).trim();

  if (scheme.toLowerCase() !== AUTH_SCHEME.toLowerCase()) {
    return { error: `Unsupported authorization scheme "${scheme}". Expected "${AUTH_SCHEME}".` };
  }
  if (credentials === '') {
    return { error: 'Empty bearer token.' };
  }

  return { token: credentials };
}

export function verifyAuthorizationHeader(headerValue, allowedTokens) {
  const extracted = extractBearerToken(headerValue);
  if (extracted.error) {
    return { ok: false, reason: 'missing_token', message: extracted.error };
  }

  const candidateDigest = sha256(extracted.token);
  let matched = false;
  for (const token of allowedTokens) {
    if (timingSafeEqual(candidateDigest, sha256(token))) {
      matched = true;
    }
  }

  if (!matched) {
    return {
      ok: false,
      reason: 'invalid_token',
      message: 'Invalid bearer token.',
    };
  }

  return { ok: true, token: extracted.token };
}

function sha256(value) {
  return createHash('sha256').update(value, 'utf8').digest();
}
