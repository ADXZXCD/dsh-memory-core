import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const SKILL_CONTENT_RULES = Object.freeze([
  ['english-report-heading', /^(?:Problem|Decision|Alternatives considered|Consequences)\s*[:：]/m, '报告标题应使用中文'],
  ['global-authorization', /全局授权/, '授权必须限定在当前任务或会话'],
  ['fixed-row-report', /三到五行/, '用内容字段代替固定行数'],
  ['old-inspect-tool', /\bcordis_inspect\b(?!_list|_query)/, '使用当前 cordis_inspect_list/query 协议'],
  ['unsafe-everyone-permission', /Everyone 至少/, '按 UID/GID、ACL 和最小权限核验'],
  ['unbounded-scan', /全盘 grep/, '使用限定目录的定向扫描'],
  ['conflicting-first-step', /第一步，必做/, '确认前置步骤顺序唯一'],
  ['english-output-instruction', /Output findings in/, '发现项可保留 file:line，但最终报告用中文'],
  ['duplicate-selfcheck-step', /Step 0\.5：脚本健康自检/, '合并重复的环境自检步骤']
]);

export function walkSkillFiles(root) {
  const base = resolve(root);
  if (!existsSync(base)) return [];
  const out = [];
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile() && entry.name === 'SKILL.md') out.push(path);
    }
  }
  walk(base);
  return out.sort();
}

export function auditSkillContent(root, { maxLineLength = 360 } = {}) {
  const findings = [];
  const paths = walkSkillFiles(root);
  for (const path of paths) {
    const text = readFileSync(path, 'utf8');
    for (const [kind, pattern, fix] of SKILL_CONTENT_RULES) {
      const match = text.match(pattern);
      if (match) findings.push({ kind, path, line: text.slice(0, match.index).split('\n').length, severity: 'error', fix });
    }
    for (const [index, line] of text.split('\n').entries()) {
      if (line.length > maxLineLength) findings.push({ kind: 'long-line', path, line: index + 1, severity: 'warning', fix: '拆成短句或移到按需 references 文件' });
    }
  }
  return {
    ok: !findings.some((item) => item.severity === 'error'),
    root: resolve(root),
    skills: paths.length,
    errors: findings.filter((item) => item.severity === 'error'),
    warnings: findings.filter((item) => item.severity === 'warning'),
    findings
  };
}
