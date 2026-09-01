import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';

export const INDEX_NAME = 'memory-index.md';

export function parseIndex(text) {
  return text.split('\n').flatMap((line, lineNumber) => {
    const match = line.match(/^-\s+(.+?)（触发词：([^）]+)）→\s*(.+)$/);
    if (!match) return [];
    const rawTriggers = match[2].trim();
    return [{
      title: match[1],
      rawTriggers,
      triggers: rawTriggers.split('/').map((item) => item.trim()).filter(Boolean),
      malformedTriggers: !rawTriggers.includes('/') && rawTriggers.split(/\s+/).filter(Boolean).length > 2,
      path: match[3].replace(/`/g, '').trim(),
      line: lineNumber + 1
    }];
  });
}

export function isPrivatePath(path) {
  return /(?:^|[\\/])private[\\/]/.test(path);
}

function isShortLatin(value) {
  return /^[a-z0-9]+$/i.test(value) && value.length < 3;
}

export function matches(row, query) {
  const keyword = query.toLowerCase();
  for (const trigger of row.triggers) {
    const term = trigger.toLowerCase();
    if (keyword === term) return true;
    if (isShortLatin(keyword) || isShortLatin(term)) continue;
    if (keyword.length >= 3 && term.length >= 3 && keyword.includes(term)) return true;
  }
  const genericLatin = /^[a-z0-9]+$/i.test(keyword) && keyword.length <= 3;
  return !genericLatin && keyword.length >= 3 && `${row.title} ${row.path}`.toLowerCase().includes(keyword);
}

function selectIndex(root) {
  const canonical = join(root, INDEX_NAME);
  if (existsSync(canonical)) return canonical;
  const legacy = join(root, 'MEMORY.md');
  return existsSync(legacy) ? legacy : null;
}

function privateIntent(query) {
  return /(?:凭据|密码|密钥|api\s*key|token|登录信息|ssh\s*凭据)/i.test(query);
}

function sourceRows(home, projectDir) {
  const sources = [['global', home]];
  if (projectDir) sources.push(['project', join(resolve(projectDir), '.dsh', 'memory')]);
  return sources.flatMap(([layer, root]) => {
    const indexPath = selectIndex(root);
    if (!indexPath) return [];
    return parseIndex(readFileSync(indexPath, 'utf8')).map((row) => ({
      ...row, layer, indexPath, absolute: resolve(dirname(indexPath), row.path), private: isPrivatePath(row.path)
    }));
  });
}

export function route({ home, projectDir = null, query }) {
  const keyword = String(query || '').trim();
  if ([...keyword].length < 2) return { query: keyword, hits: [], message: 'query-too-short', integrityFailure: false };
  const results = sourceRows(home, projectDir).filter((row) => (!row.private || privateIntent(keyword)) && matches(row, keyword));
  const merged = new Map();
  for (const row of results) {
    const key = `${row.private ? 'private' : 'public'}:${row.absolute}`;
    const existing = merged.get(key);
    if (existing) existing.layers = [...new Set([...existing.layers, row.layer])];
    else merged.set(key, { ...row, layers: [row.layer] });
  }
  const hits = [...merged.values()];
  return { query: keyword, hits, integrityFailure: hits.some((row) => !existsSync(row.absolute)) };
}

function walk(root, predicate) {
  if (!existsSync(root)) return [];
  const out = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const path = join(root, entry.name);
    if (entry.isDirectory()) out.push(...walk(path, predicate));
    else if (entry.isFile() && predicate(path, entry.name)) out.push(path);
  }
  return out;
}

function inside(root, target) {
  const rel = relative(resolve(root), resolve(target));
  return rel === '' || (!rel.startsWith('..') && !rel.startsWith(`..${'/'}`) && !rel.startsWith(`..${'\\'}`));
}

function skillMeta(path) {
  const text = readFileSync(path, 'utf8').slice(0, 1600);
  const field = (key) => (text.match(new RegExp(`^${key}\\s*:\\s*(.*)$`, 'm')) || [])[1]?.trim() || '';
  return { name: field('name'), description: field('description') };
}

export function audit({ home, projectDir = null }) {
  const errors = [];
  const warnings = [];
  const sources = [['global', home]];
  if (projectDir) sources.push(['project', join(resolve(projectDir), '.dsh', 'memory')]);
  const rows = [];
  for (const [layer, root] of sources) {
    const indexPath = selectIndex(root);
    if (!indexPath) {
      if (layer === 'global' || projectDir) errors.push({ kind: 'missing-index', layer, path: join(root, INDEX_NAME) });
      continue;
    }
    for (const row of parseIndex(readFileSync(indexPath, 'utf8'))) {
      const target = resolve(dirname(indexPath), row.path);
      rows.push({ ...row, layer, indexPath, target });
      if (row.malformedTriggers) errors.push({ kind: 'malformed-trigger-delimiter', indexPath, line: row.line, detail: row.rawTriggers });
      if (!inside(root, target)) errors.push({ kind: 'index-target-outside-root', indexPath, line: row.line, detail: row.path });
      else if (!existsSync(target)) errors.push({ kind: 'missing-index-target', indexPath, line: row.line, detail: row.path });
    }
  }
  for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) {
    if (rows[i].layer !== rows[j].layer) continue;
    const overlap = rows[i].triggers.filter((left) => rows[j].triggers.some((right) => left.toLowerCase() === right.toLowerCase() || (left.length >= 3 && right.length >= 3 && (left.includes(right) || right.includes(left)))));
    if (overlap.length) errors.push({ kind: 'same-layer-trigger-overlap', detail: `${rows[i].title} x ${rows[j].title}: ${overlap.join(',')}` });
  }
  const topics = walk(join(home, 'topics'), (path, name) => name.endsWith('.md'));
  const indexed = new Set(rows.map((row) => row.target));
  for (const topic of topics) {
    if (!indexed.has(resolve(topic))) warnings.push({ kind: 'orphan-topic', path: topic });
    const header = readFileSync(topic, 'utf8').slice(0, 1800);
    if (!/状态[:：]/.test(header)) warnings.push({ kind: 'topic-missing-status', path: topic });
    if (!/作用域[:：]/.test(header)) warnings.push({ kind: 'topic-missing-scope', path: topic });
  }
  const skills = walk(join(home, 'skills'), (path, name) => name === 'SKILL.md');
  const names = new Map();
  const hashes = new Map();
  for (const skill of skills) {
    const meta = skillMeta(skill);
    if (!meta.name || !meta.description) errors.push({ kind: 'invalid-skill-frontmatter', path: skill });
    if (meta.name) names.set(meta.name, [...(names.get(meta.name) || []), skill]);
    const hash = createHash('sha256').update(readFileSync(skill)).digest('hex');
    hashes.set(hash, [...(hashes.get(hash) || []), skill]);
  }
  for (const [name, paths] of names) if (paths.length > 1) errors.push({ kind: 'duplicate-skill-name', detail: name, paths });
  for (const [hash, paths] of hashes) if (paths.length > 1) warnings.push({ kind: 'duplicate-skill-content', detail: hash.slice(0, 12), paths });
  return { ok: errors.length === 0, rows, topics, skills, errors, warnings };
}

export function renderRoute(result) {
  if (result.message === 'query-too-short') return `query too short: ${result.query}`;
  if (!result.hits.length) return `no route hit: ${result.query}`;
  return result.hits.map((row) => `${row.private ? '[private]' : '[public]'} ${row.title} -> ${row.absolute}`).join('\n');
}

export function renderAudit(result) {
  const lines = [`audit: ${result.ok ? 'clean' : 'errors'}; rows=${result.rows.length} topics=${result.topics.length} skills=${result.skills.length}`];
  for (const item of result.errors) lines.push(`ERROR ${item.kind}: ${item.path || item.detail || ''}`);
  for (const item of result.warnings) lines.push(`WARN ${item.kind}: ${item.path || item.detail || ''}`);
  return lines.join('\n');
}
