import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DATASET_FILES = {
  nodes: 'node.json',
  responses: 'response.json',
  triggers: 'trigger.json',
  actions: 'action.json',
  resourceTemplates: 'resourceTemplate.json',
};

const SOURCE_DIR = dirname(fileURLToPath(import.meta.url));

export function candidateDataDirs({ dataDir = process.env.DATA_DIR } = {}) {
  if (dataDir) {
    return [dataDir];
  }
  return [process.cwd(), resolve(SOURCE_DIR, '..'), resolve(SOURCE_DIR, '..', '..')];
}

export function resolveDataDir(options = {}) {
  const candidates = candidateDataDirs(options);
  const found = candidates.find(hasAllDatasetFiles);
  if (found) {
    return found;
  }
  throw new Error(
    `Unable to locate the dataset files (${Object.values(DATASET_FILES).join(', ')}). ` +
      `Searched: ${candidates.map((candidate) => `"${candidate}"`).join(', ')}. ` +
      'Set DATA_DIR to the folder that contains them.',
  );
}

function hasAllDatasetFiles(directory) {
  return Object.values(DATASET_FILES).every((fileName) => existsSync(join(directory, fileName)));
}

export function loadDataset({ dataDir = process.env.DATA_DIR } = {}) {
  const resolvedDir = resolveDataDir({ dataDir });
  const files = {};
  for (const [key, fileName] of Object.entries(DATASET_FILES)) {
    files[key] = readJsonArray(join(resolvedDir, fileName));
  }

  const warnings = [];

  const nodes = files.nodes;
  const responses = files.responses;
  const triggers = files.triggers;
  const actions = files.actions;
  const resourceTemplates = files.resourceTemplates;

  const nodesById = indexById(nodes, 'nodes', warnings);
  const nodesByCompositeId = indexByCompositeKey(nodes, 'compositeId', 'nodes', warnings);
  const responsesById = indexById(responses, 'responses', warnings);
  const triggersById = indexById(triggers, 'triggers', warnings);
  const actionsById = indexById(actions, 'actions', warnings);
  const resourceTemplatesById = indexById(resourceTemplates, 'resourceTemplates', warnings);

  for (const node of nodes) {
    for (const compositeId of node.parents ?? []) {
      if (!nodesByCompositeId.has(compositeId)) {
        warnings.push(`node ${node._id}: parent compositeId "${compositeId}" not found`);
      }
    }
    if (node.trigger != null && !triggersById.has(node.trigger)) {
      warnings.push(`node ${node._id}: trigger "${node.trigger}" not found`);
    }
    for (const responseId of node.responses ?? []) {
      if (!responsesById.has(responseId)) {
        warnings.push(`node ${node._id}: response "${responseId}" not found`);
      }
    }
    for (const actionId of referencedActionIds(node)) {
      if (!actionsById.has(actionId)) {
        warnings.push(`node ${node._id}: action "${actionId}" not found`);
      }
    }
  }
  for (const trigger of triggers) {
    if (trigger.resourceTemplateId != null && !resourceTemplatesById.has(trigger.resourceTemplateId)) {
      warnings.push(`trigger ${trigger._id}: resourceTemplate "${trigger.resourceTemplateId}" not found`);
    }
  }
  for (const action of actions) {
    if (action.resourceTemplateId != null && !resourceTemplatesById.has(action.resourceTemplateId)) {
      warnings.push(`action ${action._id}: resourceTemplate "${action.resourceTemplateId}" not found`);
    }
  }

  return {
    dataDir: resolvedDir,
    nodes,
    responses,
    triggers,
    actions,
    resourceTemplates,
    nodesById,
    nodesByCompositeId,
    responsesById,
    triggersById,
    actionsById,
    resourceTemplatesById,
    warnings,
  };
}

export function referencedActionIds(node) {
  const ids = [];
  const seen = new Set();
  for (const list of [node.preActions, node.actions, node.postActions]) {
    for (const id of list ?? []) {
      if (id != null && !seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }
    }
  }
  return ids;
}

function readJsonArray(filePath) {
  let raw;
  try {
    raw = readFileSync(filePath, 'utf8');
  } catch (error) {
    throw new Error(`Unable to read dataset file "${filePath}": ${error.message}`);
  }

  raw = raw.replace(/^\uFEFF/, '');

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON in dataset file "${filePath}": ${error.message}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`Dataset file "${filePath}" must contain a JSON array`);
  }
  return parsed;
}

function indexById(collection, label, warnings) {
  const index = new Map();
  for (const document of collection) {
    const id = document?._id;
    if (id == null) {
      warnings.push(`${label}: document without _id ignored`);
      continue;
    }
    if (index.has(id)) {
      warnings.push(`${label}: duplicate _id "${id}" (last occurrence wins)`);
    }
    index.set(String(id), document);
  }
  return index;
}

function indexByCompositeKey(collection, key, label, warnings) {
  const index = new Map();
  for (const document of collection) {
    const value = document?.[key];
    if (value == null) {
      continue;
    }
    if (index.has(value)) {
      warnings.push(`${label}: duplicate ${key} "${value}" (last occurrence wins)`);
    }
    index.set(String(value), document);
  }
  return index;
}
