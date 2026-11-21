import { referencedActionIds } from './datasource.js';
import { JSONScalar, LongScalar } from './scalars.js';

export function createResolvers(dataset) {
  const {
    nodesByCompositeId,
    responsesById,
    triggersById,
    actionsById,
    resourceTemplatesById,
  } = dataset;

  const getTemplate = (resourceTemplateId) =>
    resourceTemplateId == null
      ? null
      : resourceTemplatesById.get(String(resourceTemplateId)) ?? null;

  const getTrigger = (triggerId) =>
    triggerId == null ? null : triggersById.get(String(triggerId)) ?? null;

  const getResponse = (responseId) =>
    responseId == null ? null : responsesById.get(String(responseId)) ?? null;

  const getAction = (actionId) =>
    actionId == null ? null : actionsById.get(String(actionId)) ?? null;

  const getParent = (compositeId) =>
    compositeId == null ? null : nodesByCompositeId.get(String(compositeId)) ?? null;

  return {
    Long: LongScalar,
    JSON: JSONScalar,

    Query: {
      node: (_parent, { nodeId }) => {
        if (nodeId == null) {
          return null;
        }
        const key = String(nodeId).trim();
        return dataset.nodesById.get(key) ?? null;
      },
    },

    NodeObject: {
      parentIds: (node) => (node.parents == null ? null : node.parents),
      parents: (node) => (node.parents == null ? null : node.parents.map(getParent)),

      triggerId: (node) => node.trigger ?? null,
      trigger: (node) => getTrigger(node.trigger),

      responseIds: (node) => (node.responses == null ? null : node.responses),
      responses: (node) => (node.responses == null ? null : node.responses.map(getResponse)),

      actionIds: (node) => referencedActionIds(node),
      actions: (node) => referencedActionIds(node).map(getAction),

      priority: (node) => node.priority ?? null,
      colour: (node) => node.colour ?? null,
    },

    Trigger: {
      description: (trigger) => trigger.description ?? null,
      functionString: (trigger) => trigger.functionString ?? null,
      updatedAt: (trigger) => trigger.updatedAt ?? null,
      resourceTemplateId: (trigger) => trigger.resourceTemplateId ?? null,
      resourceTemplate: (trigger) => getTemplate(trigger.resourceTemplateId),
    },

    Action: {
      description: (action) => action.description ?? null,
      functionString: (action) => action.functionString ?? null,
      updatedAt: (action) => action.updatedAt ?? null,
      resourceTemplateId: (action) => action.resourceTemplateId ?? null,
      resourceTemplate: (action) => getTemplate(action.resourceTemplateId),
    },

    ResourceTemplate: {
      createdAt: (template) => template.createdAt ?? template.updatedAt ?? 0,
      description: (template) => template.description ?? null,
      schema: (template) => template.schema ?? null,
      integrationId: (template) => template.integrationId ?? null,
      functionString: (template) => template.functionString ?? null,
      key: (template) => template.key ?? null,
    },

    Response: {
      description: (response) => response.description ?? null,
      updatedAt: (response) => response.updatedAt ?? null,
      platforms: (response) =>
        response.platforms == null ? null : response.platforms.map(toResponsePlatform),
    },
  };
}

function toResponsePlatform(platform) {
  return {
    ...platform,
    integrationId: platform.integrationId ?? null,
    localeGroups:
      platform.localeGroups == null
        ? null
        : platform.localeGroups.map(toResponseLocaleGroup),
  };
}

function toResponseLocaleGroup(localeGroup) {
  return {
    ...localeGroup,
    localeGroupId: localeGroup.localeGroupId ?? localeGroup.localeGroup ?? null,
    variations: localeGroup.variations == null ? null : localeGroup.variations.map(toResponseVariation),
  };
}

function toResponseVariation(variation) {
  return {
    ...variation,
    name: variation.name ?? null,
    responses: variation.responses ?? null,
  };
}
