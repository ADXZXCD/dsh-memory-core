import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { audit, parseIndex, route } from '../src/index.mjs';

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'dsh-memory-core-'));
  mkdirSync(join(root, 'topics'), { recursive: true });
  mkdirSync(join(root, 'private'), { recursive: true });
  mkdirSync(join(root, 'skills', 'sample'), { recursive: true });
  mkdirSync(join(root, 'skills', 'duplicate'), { recursive: true });
  writeFileSync(join(root, 'topics', 'custom.md'), '> 状态：current。作用域：global。\n# Custom\n');
  writeFileSync(join(root, 'private', 'credentials.md'), '# Private\n');
  writeFileSync(join(root, 'skills', 'sample', 'SKILL.md'), '---\nname: sample\ndescription: A sample skill.\n---\n# Sample\n');
  writeFileSync(join(root, 'skills', 'duplicate', 'SKILL.md'), '---\nname: sample\ndescription: A duplicate sample skill.\n---\n# Duplicate\n');
  writeFileSync(join(root, 'memory-index.md'), [
    '- Custom（触发词：custom route/自定义路由）→ `topics/custom.md`',
    '- Credentials（触发词：token）→ `private/credentials.md`'
  ].join('\n') + '\n');
  return root;
}

test('parses slash-delimited triggers and flags ambiguous space lists', () => {
  const rows = parseIndex('- A（触发词：one/two）→ topics/a.md\n- B（触发词：one two three）→ topics/b.md');
  assert.deepEqual(rows[0].triggers, ['one', 'two']);
  assert.equal(rows[1].malformedTriggers, true);
});

test('routes public content but hides private paths without credential intent', () => {
  const home = fixture();
  try {
    assert.equal(route({ home, query: '自定义路由' }).hits.length, 1);
    assert.equal(route({ home, query: 'token' }).hits.length, 1);
    assert.equal(route({ home, query: '普通查询 token' }).hits.length, 1);
  } finally { rmSync(home, { recursive: true, force: true }); }
});

test('audit detects malformed delimiters, missing targets, and duplicate skills', () => {
  const home = fixture();
  try {
    writeFileSync(join(home, 'memory-index.md'), '- Bad（触发词：one two three）→ topics/missing.md\n');
    const result = audit({ home });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((item) => item.kind === 'malformed-trigger-delimiter'));
    assert.ok(result.errors.some((item) => item.kind === 'missing-index-target'));
  } finally { rmSync(home, { recursive: true, force: true }); }
});
