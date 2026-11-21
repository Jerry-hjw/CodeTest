import { GraphQLError, Kind } from 'graphql';

const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
const MIN_SAFE = BigInt(Number.MIN_SAFE_INTEGER);

export const LongScalar = {
  name: 'Long',
  description:
    '64-bit integer encoded as a JSON number (milliseconds since epoch). ' +
    'Values outside the JavaScript safe-integer range are encoded as decimal strings.',

  serialize(value) {
    const big = toBigInt(value);
    if (big === null) {
      throw new GraphQLError(`Long cannot represent value: ${inspect(value)}`);
    }
    return big >= MIN_SAFE && big <= MAX_SAFE ? Number(big) : big.toString();
  },

  parseValue(value) {
    const big = toBigInt(value);
    if (big === null) {
      throw new GraphQLError(`Long cannot represent value: ${inspect(value)}`);
    }
    return big >= MIN_SAFE && big <= MAX_SAFE ? Number(big) : big;
  },

  parseLiteral(ast) {
    if (ast.kind === Kind.INT || ast.kind === Kind.STRING) {
      const big = toBigInt(ast.value);
      if (big === null) {
        throw new GraphQLError(`Long cannot represent literal: ${ast.value}`, {
          nodes: ast,
        });
      }
      return big >= MIN_SAFE && big <= MAX_SAFE ? Number(big) : big;
    }
    throw new GraphQLError('Long cannot represent a non integer literal', {
      nodes: ast,
    });
  },
};

export const JSONScalar = {
  name: 'JSON',
  description: 'Arbitrary JSON value (object, array, or primitive).',

  serialize(value) {
    return value;
  },

  parseValue(value) {
    assertJsonSerializable(value);
    return value;
  },

  parseLiteral(ast, variables) {
    return parseJsonLiteral(ast, variables);
  },
};

function parseJsonLiteral(ast, variables) {
  switch (ast.kind) {
    case Kind.NULL:
      return null;
    case Kind.STRING:
    case Kind.ENUM:
    case Kind.BOOLEAN:
      return ast.value;
    case Kind.INT:
      return Number.parseInt(ast.value, 10);
    case Kind.FLOAT:
      return Number.parseFloat(ast.value);
    case Kind.LIST:
      return ast.values.map((value) => parseJsonLiteral(value, variables));
    case Kind.OBJECT: {
      const result = Object.create(null);
      for (const field of ast.fields) {
        result[field.name.value] = parseJsonLiteral(field.value, variables);
      }
      return result;
    }
    case Kind.VARIABLE:
      return variables ? variables[ast.name.value] : undefined;
    default:
      throw new GraphQLError(`JSON cannot represent literal of kind ${ast.kind}`, {
        nodes: ast,
      });
  }
}

function toBigInt(value) {
  if (typeof value === 'bigint') {
    return value;
  }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? BigInt(value) : null;
  }
  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) {
    return BigInt(value.trim());
  }
  return null;
}

function assertJsonSerializable(value) {
  try {
    JSON.stringify(value);
  } catch (error) {
    throw new GraphQLError(`JSON cannot represent value: ${error.message}`);
  }
}

function inspect(value) {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}
