import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { startInProcessServer } from './helpers.js';

describe('GraphQL schema and resolvers', () => {
  let api;

  before(async () => {
    api = await startInProcessServer();
  });

  after(async () => {
    await api.stop();
  });

  it('exposes every field of the supplied schema', async () => {
    const result = await api.query(`
      {
        nodeObject: __type(name: "NodeObject") { fields { name type { kind ofType { kind name } } } }
        action: __type(name: "Action") { fields { name } }
        trigger: __type(name: "Trigger") { fields { name } }
        response: __type(name: "Response") { fields { name } }
        platform: __type(name: "ResponsePlatform") { fields { name } }
        localeGroup: __type(name: "ResponseLocaleGroup") { fields { name } }
        variation: __type(name: "ResponseVariation") { fields { name } }
        resourceTemplate: __type(name: "ResourceTemplate") { fields { name } }
        query: __type(name: "Query") { fields { name args { name } } }
      }
    `);

    assert.equal(result.errors, undefined);

    const names = (type) => type.fields.map((field) => field.name);

    assert.deepEqual(names(result.data.nodeObject), [
      '_id',
      'createdAt',
      'updatedAt',
      'name',
      'description',
      'parents',
      'parentIds',
      'root',
      'trigger',
      'triggerId',
      'responses',
      'responseIds',
      'actions',
      'actionIds',
      'priority',
      'compositeId',
      'global',
      'colour',
    ]);
    assert.deepEqual(names(result.data.action), [
      '_id',
      'createdAt',
      'updatedAt',
      'name',
      'description',
      'functionString',
      'resourceTemplateId',
      'resourceTemplate',
    ]);
    assert.deepEqual(names(result.data.trigger), [
      '_id',
      'createdAt',
      'updatedAt',
      'name',
      'description',
      'functionString',
      'resourceTemplateId',
      'resourceTemplate',
    ]);
    assert.deepEqual(names(result.data.response), [
      '_id',
      'createdAt',
      'updatedAt',
      'name',
      'description',
      'platforms',
    ]);
    assert.deepEqual(names(result.data.platform), ['integrationId', 'build', 'localeGroups']);
    assert.deepEqual(names(result.data.localeGroup), ['localeGroupId', 'variations']);
    assert.deepEqual(names(result.data.variation), ['name', 'responses']);
    assert.deepEqual(names(result.data.resourceTemplate), [
      '_id',
      'createdAt',
      'updatedAt',
      'name',
      'description',
      'schema',
      'integrationId',
      'functionString',
      'key',
    ]);
    assert.deepEqual(names(result.data.query), ['node']);
    assert.deepEqual(result.data.query.fields[0].args, [{ name: 'nodeId' }]);
  });

  it('returns a root node with its responses, platforms and channel payloads', async () => {
    const result = await api.query(
      `
        query Node($nodeId: ID) {
          node(nodeId: $nodeId) {
            _id
            name
            description
            root
            global
            compositeId
            priority
            colour
            createdAt
            updatedAt
            parentIds
            parents { _id name }
            triggerId
            trigger { _id name }
            responseIds
            responses {
              _id
              name
              description
              createdAt
              updatedAt
              platforms {
                integrationId
                build
                localeGroups {
                  localeGroupId
                  variations {
                    name
                    responses
                  }
                }
              }
            }
          }
        }
      `,
      { nodeId: '6296be3470a0c1052f89cccb' },
    );

    assert.equal(result.errors, undefined);
    const node = result.data.node;

    assert.equal(node._id, '6296be3470a0c1052f89cccb');
    assert.equal(node.name, 'Greeting Message');
    assert.equal(node.description, '');
    assert.equal(node.root, true);
    assert.equal(node.global, false);
    assert.equal(node.compositeId, 'V78P4OA9maz31ORn');
    assert.equal(node.priority, null);
    assert.equal(node.colour, null);
    assert.equal(node.createdAt, 1654046260304);
    assert.equal(node.updatedAt, 1696991678515);

    assert.deepEqual(node.parentIds, []);
    assert.deepEqual(node.parents, []);

    assert.equal(node.triggerId, null);
    assert.equal(node.trigger, null);

    assert.deepEqual(node.responseIds, ['6296fcad70a0c11ddb89ccf0']);
    assert.equal(node.responses.length, 1);

    const response = node.responses[0];
    assert.equal(response.name, 'Greeting Message');
    assert.equal(response.createdAt, 1654062253768);
    assert.equal(response.updatedAt, 1696993124533);
    assert.deepEqual(
      response.platforms.map((platform) => [platform.integrationId, platform.build]),
      [
        ['woztell-essential-pack', 1],
        ['whatsapp-cloud', 2],
      ],
    );

    const whatsapp = response.platforms[1];
    assert.deepEqual(whatsapp.localeGroups.map((group) => group.localeGroupId), ['default']);
    const variation = whatsapp.localeGroups[0].variations[0];
    assert.equal(variation.name, 'Standard');

    const buttonsPayload = variation.responses[0];
    assert.equal(buttonsPayload.type, 'WHATSAPP_REPLY_BUTTONS');
    assert.equal(buttonsPayload.id, 'ZPVCmFvV');
    assert.deepEqual(
      buttonsPayload.action.buttons.map((button) => button.reply.payload),
      ['WEBINAR', 'CONSULT'],
    );

    const textPayload = response.platforms[0].localeGroups[0].variations[0].responses[0];
    assert.deepEqual(textPayload, {
      type: 'TEXT',
      text: 'hello {{firstName}}',
      id: 'WxPXEokG',
      transform: '',
    });
  });

  it('resolves parents by compositeId and the actions of a node', async () => {
    const result = await api.query(
      `
        query Node($nodeId: ID) {
          node(nodeId: $nodeId) {
            _id
            name
            parentIds
            parents { _id name compositeId }
            actionIds
            actions {
              _id
              name
              description
              createdAt
              updatedAt
              resourceTemplateId
              resourceTemplate { _id name integrationId key }
            }
            responseIds
          }
        }
      `,
      { nodeId: '6297172e70a0c165b989cd10' },
    );

    assert.equal(result.errors, undefined);
    const node = result.data.node;

    assert.equal(node.name, "User's Email");
    assert.deepEqual(node.parentIds, ['rCMUtmL3aOULyqBL']);
    assert.deepEqual(node.parents, [
      { _id: '6297164810f52524ba1a9300', name: 'Sign up Webinar', compositeId: 'rCMUtmL3aOULyqBL' },
    ]);

    assert.deepEqual(node.actionIds, ['6530933e6a1690d2f0c78a92']);

    assert.deepEqual(node.actions, [
      {
        _id: '6530933e6a1690d2f0c78a92',
        name: 'Send Email Action',
        description: '',
        createdAt: 1697682238144,
        updatedAt: 1697682238144,
        resourceTemplateId: '62cfc19bf4573e1b32ca2295',
        resourceTemplate: {
          _id: '62cfc19bf4573e1b32ca2295',
          name: 'Send Email',
          integrationId: 'email',
          key: null,
        },
      },
    ]);
  });

  it('resolves a trigger and its resource template', async () => {
    const result = await api.query(
      `
        query Node($nodeId: ID) {
          node(nodeId: $nodeId) {
            _id
            triggerId
            trigger {
              _id
              name
              description
              functionString
              createdAt
              updatedAt
              resourceTemplateId
              resourceTemplate {
                _id
                name
                description
                createdAt
                updatedAt
                integrationId
                key
                schema
                functionString
              }
            }
          }
        }
      `,
      { nodeId: '6297164810f52524ba1a9300' },
    );

    assert.equal(result.errors, undefined);
    const node = result.data.node;

    assert.equal(node.triggerId, '629716db70a0c1202689cd0a');
    assert.equal(node.trigger.name, 'Payload: WEBINAR');
    assert.equal(node.trigger.createdAt, 1654068955016);

    assert.equal(node.trigger.updatedAt, null);
    assert.equal(node.trigger.functionString, null);

    const template = node.trigger.resourceTemplate;
    assert.equal(template._id, '61e9ba20f9b581f25a2dbf51');
    assert.equal(template.name, 'Keyword / Payload');
    assert.equal(template.key, 'keyword-payload');
    assert.equal(template.integrationId, 'woztell-essential-pack');

    assert.equal(template.createdAt, 1727122901548);
    assert.equal(template.updatedAt, 1727122901548);
    assert.equal(template.schema.title, 'Keyword Payload Template');
    assert.equal(typeof template.functionString, 'string');
  });

  it('returns null for optional relations that are absent in the dataset', async () => {
    const result = await api.query(
      `{ node(nodeId: "62971b3470a0c1803c89cd15") { name triggerId trigger { name } responseIds responses { name } actionIds actions { name } } }`,
    );

    assert.equal(result.errors, undefined);
    assert.deepEqual(result.data.node, {
      name: '12PM Timeslot',
      triggerId: null,
      trigger: null,
      responseIds: null,
      responses: null,
      actionIds: [],
      actions: [],
    });
  });

  it('returns null for an unknown node and for a missing nodeId', async () => {
    const unknown = await api.query(`{ node(nodeId: "does-not-exist") { _id } }`);
    assert.equal(unknown.errors, undefined);
    assert.equal(unknown.data.node, null);

    const missing = await api.query(`{ node { _id } }`);
    assert.equal(missing.errors, undefined);
    assert.equal(missing.data.node, null);
  });

  it('rejects a query that asks for a field outside the schema', async () => {
    const result = await api.query(`{ node(nodeId: "6296be3470a0c1052f89cccb") { tags } }`);
    assert.ok(result.errors?.length);
    assert.equal(result.errors[0].extensions.code, 'GRAPHQL_VALIDATION_FAILED');
  });
});
