import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { auditSkillContent } from '../src/skill-content-audit.mjs';

test('finds hard content conflicts and separates long-line warnings', () => {
  const root = mkdtempSync(join(tmpdir(), 'dsh-skill-audit-'));
  mkdirSync(join(root, 'good'));
  mkdirSync(join(root, 'bad'));
  writeFileSync(join(root, 'good', 'SKILL.md'), '---\nname: good\ndescription: safe\n---\n');
  writeFileSync(join(root, 'bad', 'SKILL.md'), '---\nname: bad\ndescription: bad\n---\nDecision：wrong\n' + 'x'.repeat(361));
  const result = auditSkillContent(root);
  assert.equal(result.skills, 2);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((item) => item.kind === 'english-report-heading'));
  assert.ok(result.warnings.some((item) => item.kind === 'long-line'));
});

test('clean content passes strict semantics with no files leaked', () => {
  const root = mkdtempSync(join(tmpdir(), 'dsh-skill-audit-'));
  mkdirSync(join(root, 'good'));
  writeFileSync(join(root, 'good', 'SKILL.md'), '---\nname: good\ndescription: safe\n---\n结论：只读审查。\n');
  const result = auditSkillContent(root);
  assert.equal(result.ok, true);
  assert.equal(result.errors.length, 0);
});
