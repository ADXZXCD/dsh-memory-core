#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { homedir } from 'node:os';
import { auditCandidates, isSlug, makeCandidate, targetPaths } from '../src/evolution.mjs';

const args = process.argv.slice(2);
const command = args[0] || 'audit';
const home = process.env.DSH_MEMORY_HOME || process.env.HOME || homedir();
const root = process.env.DSH_SKILL_EVOLUTION_DIR || join(home, 'skill-evolution');
const candidatesDir = join(root, 'candidates');
const archiveDir = join(root, 'archive');
const value = (flag, fallback = '') => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] || fallback : fallback; };

function files(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isFile() && entry.name.endsWith('.json')).map((entry) => join(dir, entry.name));
}
function records() {
  return files(candidatesDir).map((path) => {
    try { return { path, data: JSON.parse(readFileSync(path, 'utf8')) }; }
    catch { return { path, data: null, error: 'invalid-json' }; }
  });
}
function capture() {
  const candidate = makeCandidate({ skill: value('--skill'), kind: value('--kind', 'lesson'), summary: value('--summary'), lesson: value('--lesson'), evidence: value('--evidence'), source: value('--source') });
  if (!isSlug(candidate.skill) || !candidate.summary || !candidate.lesson || !['lesson', 'skill', 'memory', 'conflict'].includes(candidate.kind)) {
    console.error('usage: dsh-memory-evolution capture --skill <slug> --kind lesson|skill|memory|conflict --summary <text> --lesson <text> [--evidence <text>] [--source <text>]');
    process.exitCode = 2; return;
  }
  mkdirSync(candidatesDir, { recursive: true });
  const path = join(candidatesDir, `${candidate.id.replace(/[^a-z0-9-]/gi, '').slice(0, 32)}.json`);
  writeFileSync(path, `${JSON.stringify(candidate, null, 2)}\n`, { flag: 'wx' });
  console.log(`candidate-created: ${path}`);
}
function audit() {
  const entries = records();
  const parsed = entries.filter((entry) => entry.data).map((entry) => entry.data);
  const result = auditCandidates(parsed);
  for (const entry of entries.filter((item) => item.error)) result.errors.push({ kind: entry.error, path: entry.path });
  const output = { root, candidateCount: entries.length, pendingCount: result.pending.length, ...result };
  if (args.includes('--json')) console.log(JSON.stringify(output, null, 2));
  else {
    console.log(`skill-evolution-audit: ${output.ok ? 'clean' : 'errors'}; candidates=${output.candidateCount} pending=${output.pendingCount}`);
    for (const item of output.errors) console.log(`ERROR ${item.kind}: ${item.id || item.path}`);
    for (const item of output.warnings) console.log(`WARN ${item.kind}: ${item.id}`);
    for (const item of output.pending) console.log(`PENDING ${item.id}: [${item.skill}/${item.kind}] ${item.summary} -> ${targetPaths(item).skillMemory}`);
  }
  if (args.includes('--strict') && output.errors.length) process.exitCode = 1;
}
function question() {
  const pending = records().filter((entry) => entry.data?.status === 'pending').map((entry) => entry.data);
  if (!pending.length) { console.log('没有待确认候选。'); return; }
  console.log(`发现 ${pending.length} 条待确认的全局技能进化候选；尚未写入正式 Skill 或记忆。`);
  for (const [index, item] of pending.entries()) console.log(`${index + 1}. [${item.skill}/${item.kind}] ${item.summary}\n   建议：${item.lesson}\n   目标：${targetPaths(item).skillMemory}`);
  console.log('请用户确认候选编号和写入目标；没有明确确认时保持 pending。');
}
function archive() {
  const id = value('--id');
  if (!args.includes('--confirmed')) { console.error('archive requires --confirmed after the approved write'); process.exitCode = 2; return; }
  const path = files(candidatesDir).find((item) => basename(item, '.json').startsWith(id));
  if (!path) { console.error('candidate not found'); process.exitCode = 1; return; }
  mkdirSync(archiveDir, { recursive: true }); renameSync(path, join(archiveDir, basename(path))); console.log(`candidate-archived: ${id}`);
}
if (command === 'capture') capture();
else if (command === 'audit') audit();
else if (command === 'question') question();
else if (command === 'archive') archive();
else { console.error('usage: dsh-memory-evolution capture|audit|question|archive'); process.exitCode = 2; }
