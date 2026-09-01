export const CANDIDATE_KINDS = new Set(['lesson', 'skill', 'memory', 'conflict']);

export function isSlug(value) {
  return /^[a-z0-9][a-z0-9-]*$/i.test(String(value || ''));
}

export function redact(value) {
  return String(value || '')
    .replace(/(gh[pousr]_|github_pat_)[A-Za-z0-9_]{12,}/gi, '$1[REDACTED]')
    .replace(/(password|passwd|token|secret|api[_-]?key)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]');
}

export function makeCandidate(input, now = new Date(), id = `${now.toISOString()}-${Math.random().toString(36).slice(2, 8)}`) {
  const candidate = {
    schema: 1,
    id,
    status: 'pending',
    scope: 'global',
    skill: String(input.skill || '').toLowerCase(),
    kind: input.kind || 'lesson',
    summary: redact(input.summary),
    lesson: redact(input.lesson),
    evidence: redact(input.evidence),
    source: redact(input.source),
    createdAt: now.toISOString()
  };
  return { ...candidate, proposedTargets: targetPaths(candidate) };
}

export function targetPaths(candidate) {
  return {
    skillMemory: `topics/skill-${candidate.skill}.md`,
    skill: `skills/${candidate.skill}/SKILL.md`
  };
}

export function validateCandidate(candidate) {
  const errors = [];
  for (const field of ['id', 'skill', 'kind', 'summary', 'lesson', 'createdAt']) if (!candidate?.[field]) errors.push(`missing-${field}`);
  if (candidate?.scope !== undefined && candidate.scope !== 'global') errors.push('non-global-scope-blocked');
  if (candidate?.skill && !isSlug(candidate.skill)) errors.push('invalid-skill-slug');
  if (candidate?.kind && !CANDIDATE_KINDS.has(candidate.kind)) errors.push('invalid-kind');
  return errors;
}

export function auditCandidates(candidates) {
  const errors = [];
  const warnings = [];
  const seen = new Map();
  for (const item of candidates) {
    const validation = validateCandidate(item);
    for (const kind of validation) errors.push({ kind, id: item?.id || 'unknown' });
    if (item?.status && item.status !== 'pending') warnings.push({ kind: `status-${item.status}`, id: item.id });
    const key = `${item?.skill || ''}:${item?.summary || ''}`.toLowerCase();
    if (key !== ':' && seen.has(key)) errors.push({ kind: 'duplicate-summary', id: item.id, other: seen.get(key) });
    else if (key !== ':') seen.set(key, item.id);
  }
  return { ok: errors.length === 0, errors, warnings, pending: candidates.filter((item) => item?.status === 'pending') };
}
