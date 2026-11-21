# GraphQL API Server — Backend Engineer Code Test

Apollo Server 4 / Node.js service that exposes the supplied GraphQL schema over the supplied
JSON files (`node.json`, `response.json`, `trigger.json`, `action.json`,
`resourceTemplate.json`). Every request must be authenticated with a **Bearer token**.

---

## Bearer token

```
ct_graphql_9f4b2c7d1e6a8b3f5c0d2e4a6b8c1d3e
```

Send it as `Authorization: Bearer <token>`. Any other scheme (`Basic`, raw token, missing
header) is rejected with **HTTP 401** and a `UNAUTHENTICATED` GraphQL error.

The token can be changed (or rotated) with the `AUTH_TOKEN` environment variable; a
comma-separated list is accepted.

---

## Quick start

Run everything from **this folder** (`codeTestSubmmison/`):

```bash
npm install
npm start          # http://localhost:4000/  (PORT / HOST env vars respected)
npm test           # 17 tests, no network and no running server required
```

Requirements: Node.js 18+ (developed and tested on Node 22). Runtime dependencies are only
`@apollo/server` and `graphql`.

### Where the data lives

The JSON files supplied with the test stay in the parent folder (`Backend_Coding_Test/`), next
to `code_test_v1.pdf`. At startup the service looks for them in this order and uses the first
folder that contains all five files:

1. `DATA_DIR`, when the environment variable is set;
2. the current working directory;
3. this submission folder;
4. the parent folder `Backend_Coding_Test/`.

So `npm start` and `npm test` work from here with no configuration, and also work when launched
from the parent folder. The folder actually used is printed at boot
(`[bootstrap] dataset loaded from ...`).

---

## Using the API

```bash
curl -s http://localhost:4000/ \
  -H 'content-type: application/json' \
  -H 'authorization: Bearer ct_graphql_9f4b2c7d1e6a8b3f5c0d2e4a6b8c1d3e' \
  --data '{"query":"{ node(nodeId: \"6296be3470a0c1052f89cccb\") { _id name root responseIds } }"}'
```

```json
{"data":{"node":{"_id":"6296be3470a0c1052f89cccb","name":"Greeting Message","root":true,
"responseIds":["6296fcad70a0c11ddb89ccf0"]}}}
```

A fuller example — one node with its parents, trigger, responses and channel payloads:

```graphql
query Node($nodeId: ID) {
  node(nodeId: $nodeId) {
    _id
    name
    root
    compositeId
    parentIds
    parents { _id name }
    triggerId
    trigger {
      name
      resourceTemplate { name key integrationId }
    }
    responseIds
    responses {
      name
      platforms {
        integrationId
        build
        localeGroups {
          localeGroupId
          variations { name responses }
        }
      }
    }
    actionIds
    actions { name resourceTemplate { name } }
  }
}
```

PowerShell equivalent:

```powershell
$body = @{ query = 'query($id: ID) { node(nodeId: $id) { _id name parentIds responses { name } } }';
           variables = @{ id = '62971a9570a0c12bb389cd13' } } | ConvertTo-Json
Invoke-RestMethod -Uri http://localhost:4000/ -Method Post -Body $body -ContentType 'application/json' `
  -Headers @{ Authorization = 'Bearer ct_graphql_9f4b2c7d1e6a8b3f5c0d2e4a6b8c1d3e' }
```

Introspection is enabled, so GraphiQL/Postman/Apollo Explorer can load the schema once the
`Authorization` header is configured.

---

## How the schema maps onto the data

The supplied documents and the supplied schema do not use identical field names, so the mapping
below is the core of the implementation (the source code itself is comment-free by request).

| GraphQL field | Source |
| --- | --- |
| `Query.node(nodeId: ID)` | `node.json`, looked up by `_id`. Unknown or omitted id → `null`. |
| `NodeObject.parents` | `node.parents` contains **compositeIds** (`"V78P4OA9maz31ORn"`), not `_id`s, so it is resolved through a compositeId index. |
| `NodeObject.parentIds` | The raw values of `node.parents`. A node whose `parents` is `null` returns `null`. |
| `NodeObject.trigger` / `triggerId` | `node.trigger` holds a **single id**: `triggerId` returns it, `trigger` resolves it in `trigger.json`. |
| `NodeObject.responses` / `responseIds` | `node.responses` holds an **array of ids**: `responseIds` returns them, `responses` resolves them in `response.json`. |
| `NodeObject.actions` / `actionIds` | The documents split side effects into `preActions`, `actions`, `postActions`; the schema has one pair, so the three arrays are merged in execution order and de-duplicated. These two fields are always lists (possibly empty). |
| `NodeObject.priority`, `colour` | Not present in the documents → `null` (both nullable in the schema). |
| `Trigger` / `Action` `resourceTemplate` | `resourceTemplateId` resolved in `resourceTemplate.json`. |
| `ResponsePlatform.localeGroups.localeGroupId` | The documents call it `localeGroup`; it is exposed as `localeGroupId`. |
| `ResponseVariation.responses` | JSON scalar, returned exactly as stored (TEXT, WhatsApp reply buttons, WhatsApp lists, …). |
| `Long` scalar | Millisecond timestamps (`1654046260304`) exceed 32-bit `Int`, so a custom scalar is used. Safe integers are emitted as JSON numbers, larger values as decimal strings. |
| `JSON` scalar | Arbitrary JSON passthrough, including proper literal parsing (`parseLiteral`). |

### Data gaps and how they are handled

1. **`ResourceTemplate.createdAt` is missing** from all documents, although the schema declares
   `createdAt: Long!`. The resolver falls back to `updatedAt`, then to `0` (epoch), so the
   non-null contract is never violated.
2. **`Trigger.updatedAt` and `Response.description`** are absent from some documents; both are
   nullable in the schema and resolve to `null`.
3. **`Greeting Message Global` has `compositeId: null`.** It therefore cannot be the target of a
   `parents` reference; the compositeId index simply skips it. Its `redirect` block is not part
   of the supplied schema and is not exposed.
4. **Nullable lists keep their source shape.** `parents`/`responseIds` return `null` when the
   document has no value and `[]` when it has an empty array. Dangling references resolve to
   `null` in place (list items are nullable) instead of silently shrinking the list; at startup
   they are reported as warnings.
5. **Fields present in the data but not in the schema** (`params`, `tags`, `preActions`,
   `postActions`, `redirect`, `position`, `type`, …) are intentionally not exposed; the schema is
   implemented exactly as supplied, plus the two scalar declarations it relies on.

---

## Project layout

```
codeTestSubmmison/                  # ← this submission folder
  package.json                      # start / test scripts, 2 dependencies
  schema.graphql                    # the supplied SDL (single source of truth), loaded at runtime
  README.md
  .env.example                      # PORT / HOST / AUTH_TOKEN / DATA_DIR / DEBUG_STACKTRACES
  src/
    index.js                        # bootstrap: load dataset → start Apollo standalone server
    server.js                       # ApolloServer construction + auth context (401 before resolvers)
    schema.js                       # loads schema.graphql
    resolvers.js                    # all field resolvers / reference resolution
    datasource.js                   # dataset discovery, JSON loading, indexes, integrity warnings
    scalars.js                      # Long and JSON scalars
    auth.js                         # Bearer parsing + constant-time (SHA-256 + timingSafeEqual) comparison
  test/
    schema.test.js                  # schema shape + nested resolution
    auth.test.js                    # token parsing and HTTP 401/200 behaviour
    helpers.js                      # in-process Apollo test harness

Backend_Coding_Test/                # the folder this submission sits in (provided material)
  code_test_v1.pdf
  node.json / response.json / trigger.json / action.json / resourceTemplate.json   # given data
```

Only the files above were written for the test; the five JSON files and the PDF were provided
and are used as-is, read-only.

## Implementation notes

- **Auth runs in the Apollo context function**, i.e. before any resolver. A rejected request
  never touches the dataset. The error is a `GraphQLError` with
  `extensions.code = "UNAUTHENTICATED"` and `extensions.http.status = 401`.
- **Token comparison is constant-time** for the same reason passwords are: no timing or
  length leak.
- **CSRF prevention is turned off** on purpose: authentication is header-based only, there is no
  cookie-based session to abuse, and it keeps plain `curl` working.
- **Indexes are built once at startup** — `Map` lookups make every nested field O(1) instead of
  scanning a collection per field.
- **Dataset discovery is automatic** — `DATA_DIR` → working directory → this folder → parent
  folder, so the service runs wherever the JSON files happen to live.
- **Fail fast on bad data**: missing files or invalid JSON abort the boot with a precise message;
  duplicates and dangling references are logged as warnings.

## Tests

`npm test` runs 17 assertions covering: the exact field list of every type, root/child node
resolution, parents-by-compositeId, trigger and resource-template resolution, actions coming
from `postActions`, absent relations returning `null`, unknown/omitted ids, invalid field
selection, token parsing edge cases and HTTP `401`/`200` behaviour.

## What I would add with more time

- A `nodes`/`config` style read API and pagination — out of scope, the schema defines `node` only.
- A small in-memory cache or DataLoader to batch `parents`/`responses` lookups under load.
- `node --test --experimental-test-coverage` in CI, plus a Dockerfile for deployment.
