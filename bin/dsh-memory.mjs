#!/usr/bin/env node
import { audit, route, renderAudit, renderRoute } from '../src/index.mjs';

const args = process.argv.slice(2);
const command = args[0];
const value = args[1];
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const home = option('--home', process.env.DSH_MEMORY_HOME);
const project = option('--project', null);
const strict = args.includes('--strict');

if (!home || !['route', 'audit'].includes(command)) {
  console.error('usage: dsh-memory route <query> --home <memory-home> [--project <workspace>]');
  console.error('   or: dsh-memory audit --home <memory-home> [--project <workspace>] [--strict]');
  process.exitCode = 2;
} else if (command === 'route') {
  const result = route({ home, projectDir: project, query: value || '' });
  console.log(renderRoute(result));
  if (result.integrityFailure && strict) process.exitCode = 2;
} else {
  const result = audit({ home, projectDir: project });
  console.log(renderAudit(result));
  if (strict && result.errors.length) process.exitCode = 1;
}
