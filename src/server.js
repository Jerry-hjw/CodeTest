import { ApolloServer } from '@apollo/server';
import { GraphQLError } from 'graphql';
import { verifyAuthorizationHeader } from './auth.js';
import { createResolvers } from './resolvers.js';
import { typeDefs } from './schema.js';

export function createServer({ dataset, tokens }) {
  return new ApolloServer({
    typeDefs,
    resolvers: createResolvers(dataset),

    csrfPrevention: false,
    introspection: true,

    includeStacktraceInErrorResponses: process.env.DEBUG_STACKTRACES === 'true',
  });
}

export function createContext({ dataset, tokens }) {
  return async ({ req }) => {
    const verdict = verifyAuthorizationHeader(req?.headers?.authorization, tokens);

    if (!verdict.ok) {
      throw new GraphQLError(`UNAUTHENTICATED: ${verdict.message}`, {
        extensions: {
          code: 'UNAUTHENTICATED',
          reason: verdict.reason,
          http: { status: 401 },
        },
      });
    }

    return { dataset, auth: { token: verdict.token } };
  };
}
