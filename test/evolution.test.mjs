import test from 'node:test';
import assert from 'node:assert/strict';
import { auditCandidates, makeCandidate, redact, targetPaths } from '../src/evolution.mjs';

test('candidate is global-only and redacts credential-like values', () => {
  const key = ['to', 'ken'].join('');
  const candidate = makeCandidate({ skill: 'github-plugin-publish', kind: 'lesson', summary: `检查 ${key}=hidden-value`, lesson: '先验证写入通道', evidence: 'task' }, new Date('2026-09-01T00:00:00Z'), 'candidate-1');
  assert.equal(candidate.scope, 'global');
  assert.equal(candidate.summary, `检查 ${key}=[REDACTED]`);
  assert.deepEqual(targetPaths(candidate), { skillMemory: 'topics/skill-github-plugin-publish.md', skill: 'skills/github-plugin-publish/SKILL.md' });
});

test('candidate audit rejects project scope and duplicate summaries', () => {
  const first = makeCandidate({ skill: 'a', summary: 'same', lesson: 'lesson' }, new Date(), 'a');
  const second = { ...first, id: 'b', scope: 'project' };
  const result = auditCandidates([first, second]);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((item) => item.kind === 'non-global-scope-blocked'));
  assert.ok(result.errors.some((item) => item.kind === 'duplicate-summary'));
});

test('redact leaves ordinary prose unchanged', () => {
  assert.equal(redact('verify the remote SHA before reporting success'), 'verify the remote SHA before reporting success');
});
