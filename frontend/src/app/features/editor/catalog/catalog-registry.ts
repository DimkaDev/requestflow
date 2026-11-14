import type { CustomBlockDefinition, EditorNodeType, NodeProps, NodeRole } from '../../../core/models';
import standardPackJson from './standard.json' with { type: 'json' };
import shopPackJson from './shop.json' with { type: 'json' };
import awsPackJson from './aws.json' with { type: 'json' };
import gcpPackJson from './gcp.json' with { type: 'json' };
import techPackJson from './tech.json' with { type: 'json' };
import aiAgentPackJson from './ai-agent.json' with { type: 'json' };
import businessPackJson from './business.json' with { type: 'json' };

export interface CatalogPorts {
  in: number | 'many';
  out: number | 'many';
}

export interface CatalogBlock {
  id: string;
  name: string;
  category: string;
  nodeType: EditorNodeType;
  icon: string;
  tint: string;
  defaultLabel: string;
  keyPattern: string;
  ports: CatalogPorts;
  role: NodeRole;
  defaultProps?: Partial<NodeProps>;
  tags: string[];
  snippetHint: string;
  packId?: string;
  isCustom?: boolean;
  customBlockId?: string;
}

export interface CatalogPack {
  pack: string;
  version: number;
  title: string;
  license: {
    source: string;
    notes: string;
  };
  blocks: CatalogBlock[];
}

export interface CatalogValidationResult {
  valid: boolean;
  errors: string[];
}

const VALID_NODE_TYPES = new Set<string>([
  'source',
  'datastore',
  'service',
  'gateway',
  'db',
  'cache',
  'queue',
  'external',
  'worker',
  'client',
  'decision',
  'parallel',
  'join',
  'end',
  'note',
  'group',
]);

const VALID_ROLES = new Set<string>([
  'normal',
  'start',
  'end',
  'decision',
  'success',
  'failure',
  'abandon',
]);

const PACK_ID_PATTERN = /^[a-z0-9-]+$/;
const BLOCK_ID_PATTERN = /^[a-z0-9-_.]+$/;
const KEY_PATTERN = /^[a-z0-9-_.]{1,64}$/;
const HEX_COLOR_PATTERN = /^(#[0-9A-Fa-f]{6}|var\(--[a-z0-9-]+\))$/;

export function validateCatalogPack(raw: unknown): CatalogValidationResult {
  const errors: string[] = [];
  if (!raw || typeof raw !== 'object') {
    return { valid: false, errors: ['Pack must be a JSON object'] };
  }

  const obj = raw as Record<string, unknown>;
  if (typeof obj['pack'] !== 'string' || !PACK_ID_PATTERN.test(obj['pack'])) {
    errors.push(`Invalid "pack" identifier: ${String(obj['pack'])}`);
  }
  if (typeof obj['version'] !== 'number' || obj['version'] < 1) {
    errors.push('Pack "version" must be an integer >= 1');
  }
  if (typeof obj['title'] !== 'string' || obj['title'].trim().length === 0) {
    errors.push('Pack "title" must be a non-empty string');
  }
  if (!obj['license'] || typeof obj['license'] !== 'object') {
    errors.push('Pack "license" object is required');
  } else {
    const lic = obj['license'] as Record<string, unknown>;
    if (!['own', 'generic', 'vendor', 'own-generic'].includes(String(lic['source']))) {
      errors.push(`Invalid license.source: ${String(lic['source'])}`);
    }
    if (typeof lic['notes'] !== 'string') {
      errors.push('license.notes must be a string');
    }
  }

  if (!Array.isArray(obj['blocks']) || obj['blocks'].length === 0) {
    errors.push('Pack "blocks" must be a non-empty array');
  } else {
    const seenIds = new Set<string>();
    obj['blocks'].forEach((b, idx) => {
      if (!b || typeof b !== 'object') {
        errors.push(`Block at index ${idx} is not an object`);
        return;
      }
      const blk = b as Record<string, unknown>;
      const id = String(blk['id'] ?? '');
      if (!BLOCK_ID_PATTERN.test(id)) {
        errors.push(`Block[${idx}] invalid id "${id}"`);
      }
      if (seenIds.has(id)) {
        errors.push(`Duplicate block id "${id}" in pack "${String(obj['pack'])}"`);
      }
      seenIds.add(id);

      if (typeof blk['name'] !== 'string' || blk['name'].trim().length === 0) {
        errors.push(`Block "${id}" missing name`);
      }
      if (typeof blk['category'] !== 'string' || blk['category'].trim().length === 0) {
        errors.push(`Block "${id}" missing category`);
      }
      if (!VALID_NODE_TYPES.has(String(blk['nodeType']))) {
        errors.push(`Block "${id}" has unsupported nodeType "${String(blk['nodeType'])}"`);
      }
      if (typeof blk['icon'] !== 'string' || blk['icon'].trim().length === 0) {
        errors.push(`Block "${id}" missing icon`);
      }
      if (typeof blk['tint'] !== 'string' || !HEX_COLOR_PATTERN.test(blk['tint'])) {
        errors.push(`Block "${id}" has invalid hex tint "${String(blk['tint'])}"`);
      }
      if (typeof blk['defaultLabel'] !== 'string' || blk['defaultLabel'].trim().length === 0) {
        errors.push(`Block "${id}" missing defaultLabel`);
      }
      if (typeof blk['keyPattern'] !== 'string' || !KEY_PATTERN.test(blk['keyPattern'])) {
        errors.push(`Block "${id}" has invalid keyPattern "${String(blk['keyPattern'])}"`);
      }
      if (!VALID_ROLES.has(String(blk['role']))) {
        errors.push(`Block "${id}" has invalid role "${String(blk['role'])}"`);
      }
      if (!blk['ports'] || typeof blk['ports'] !== 'object') {
        errors.push(`Block "${id}" missing ports definition`);
      } else {
        const ports = blk['ports'] as Record<string, unknown>;
        const validPort = (val: unknown) =>
          val === 'many' || (typeof val === 'number' && Number.isInteger(val) && val >= 0);
        if (!validPort(ports['in']) || !validPort(ports['out'])) {
          errors.push(`Block "${id}" has invalid ports.in or ports.out`);
        }
      }
      if (!Array.isArray(blk['tags'])) {
        errors.push(`Block "${id}" tags must be an array`);
      }
      if (typeof blk['snippetHint'] !== 'string') {
        errors.push(`Block "${id}" missing snippetHint`);
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

const RAW_BUILT_IN_PACKS: unknown[] = [
  standardPackJson,
  shopPackJson,
  awsPackJson,
  gcpPackJson,
  techPackJson,
  aiAgentPackJson,
  businessPackJson,
];

let cachedPacks: CatalogPack[] | null = null;

export function getBuiltInCatalogPacks(): CatalogPack[] {
  if (cachedPacks) {
    return cachedPacks;
  }
  const loaded: CatalogPack[] = [];
  for (const raw of RAW_BUILT_IN_PACKS) {
    const validation = validateCatalogPack(raw);
    if (!validation.valid) {
      throw new Error(`Invalid catalog pack: ${validation.errors.join('; ')}`);
    }
    const pack = raw as CatalogPack;
    loaded.push({
      ...pack,
      blocks: pack.blocks.map((block) => ({
        ...block,
        packId: pack.pack,
      })),
    });
  }
  cachedPacks = loaded;
  return loaded;
}

export function customBlocksToCatalogPack(customBlocks: CustomBlockDefinition[]): CatalogPack {
  return {
    pack: 'my-blocks',
    version: 1,
    title: 'My Blocks',
    license: {
      source: 'own',
      notes: 'Organization custom reusable blocks',
    },
    blocks: customBlocks.map((cb) => {
      const props = (cb.defaultProps || {}) as Partial<NodeProps>;
      const role: NodeRole = (cb.role as NodeRole) || (props.role as NodeRole) || 'normal';
      const inPort = props.maxInPorts ?? props.maxIn ?? 'many';
      const outPort = props.maxOutPorts ?? props.maxOut ?? 'many';
      const slug =
        cb.keyPattern ||
        cb.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '') ||
        'custom-block';
      return {
        id: `custom.${cb.id}`,
        customBlockId: cb.id,
        isCustom: true,
        packId: 'my-blocks',
        name: cb.name,
        category: cb.category || 'Saved Blocks',
        nodeType: cb.nodeType || 'service',
        icon: cb.icon || 'lib:widgets',
        tint: cb.tint || '#0EA5E9',
        defaultLabel: cb.name,
        keyPattern: slug.slice(0, 48),
        ports: { in: inPort, out: outPort },
        role,
        defaultProps: {
          shape: props.shape ?? 'card',
          size: props.size ?? 'M',
          ...props,
        },
        tags: ['custom', 'my-blocks', cb.nodeType || 'service'],
        snippetHint: props.description || `Emit a checkpoint when the request reaches ${cb.name}.`,
      };
    }),
  };
}

export function stripIconPrefix(icon?: string | null): string {
  if (!icon) return 'dns';
  if (icon.startsWith('lib:')) {
    return icon.slice(4);
  }
  return icon;
}
