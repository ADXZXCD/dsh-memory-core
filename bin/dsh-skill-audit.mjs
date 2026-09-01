#!/usr/bin/env node
import { resolve } from 'node:path';
import { auditSkillContent } from '../src/skill-content-audit.mjs';

const args = process.argv.slice(2);
const value = (flag, fallback) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] || fallback : fallback;
};
const root = resolve(value('--skills', value('--dir', '.')));
const result = auditSkillContent(root);
if (args.includes('--json')) console.log(JSON.stringify(result, null, 2));
else {
  console.log(`dsh-skill-audit: ${result.ok ? 'clean' : 'errors'}; skills=${result.skills}; errors=${result.errors.length}; warnings=${result.warnings.length}`);
  for (const item of result.findings) console.log(`${item.severity} ${item.kind} ${item.path}:${item.line} -> ${item.fix}`);
}
if (args.includes('--strict') && !result.ok) process.exitCode = 1;
