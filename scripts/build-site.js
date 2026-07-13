#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const skillsDir = path.join(root, '.agents', 'skills');

function readFrontmatter(filePath) {
  if (!fs.existsSync(filePath)) return { name: '', description: '', version: '' };
  const content = fs.readFileSync(filePath, 'utf-8');
  const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) return { name: '', description: '', version: '' };
  const raw = fm[1];
  const nameMatch = raw.match(/^name:\s*(.+)$/m);
  const name = nameMatch ? nameMatch[1].trim() : '';

  // Handle folded/block scalar or normal string description
  let description = '';
  const descMatch = raw.match(/^description:\s*(?:"([^"]*)"|'([^']*)')\s*$/m);
  if (descMatch) {
    description = (descMatch[1] || descMatch[2] || '').trim();
  } else {
    const lines = raw.split('\n');
    let inDesc = false;
    const descLines = [];
    for (const line of lines) {
      if (line.startsWith('description:')) {
        inDesc = true;
        const after = line.slice('description:'.length).trim();
        if (after && !after.startsWith('>') && !after.startsWith('|')) {
          descLines.push(after);
        }
      } else if (inDesc) {
        if (line.startsWith(' ') || line.startsWith('\t')) {
          descLines.push(line.trimEnd());
        } else {
          break;
        }
      }
    }
    description = descLines.join(' ').trim();
  }

  const v = raw.match(/^version:\s*(.+)$/m);
  const version = v ? v[1].trim() : '';
  return { name, description, version };
}

function findSkillMdPath(slug) {
  const p = path.join(skillsDir, slug, 'SKILL.md');
  if (fs.existsSync(p)) return p;
  return '';
}

function main() {
  if (!fs.existsSync(skillsDir)) {
    console.error(`Error: Skills directory not found at ${skillsDir}`);
    process.exit(1);
  }

  const skillDirs = fs.readdirSync(skillsDir).filter((name) => {
    return fs.statSync(path.join(skillsDir, name)).isDirectory();
  });

  const skillsList = [];

  for (const slug of skillDirs) {
    const mdPath = findSkillMdPath(slug);
    if (!mdPath) continue;
    const fm = readFrontmatter(mdPath);
    const relPath = path.relative(root, mdPath).replace(/\\/g, '/');
    skillsList.push({
      slug,
      name: fm.name || slug,
      description: fm.description || 'No description provided.',
      version: fm.version || '1.0',
      path: relPath,
    });
  }

  // Categories
  const pipelineSlugs = [
    'spec-to-pr', '00-write-spec', '01-write-plan', '02-interview',
    '03-plan-to-tasks', '04-implement-tasks', '05-verify-plan',
    '06-code-review', '07-integration-validation', '08-fix-pr',
    '09-goal-fix-pr', '10-update-plan-implementation', '11-ship-pr'
  ];

  const reviewSlugs = [
    'domain-review', 'dotnet-security-performance-review', 'multi-domain-review',
    'secrets-leak-review', 'security-review', 'tdd-sdd-ddd-reviewer',
    'code-review-self', 'megabrain', 'solve-pr'
  ];

  const categories = {
    pipeline: {
      title: 'spec-to-pr Pipeline (FSM)',
      description: 'Pipeline completo de entrega desde a especificação técnica até o merge da PR.',
      skills: []
    },
    review: {
      title: 'Review & Auditoria de Código',
      description: 'Agentes especialistas em auditoria de segurança, performance, arquitetura e domínios.',
      skills: []
    },
    general: {
      title: 'Utilidades & Frontend',
      description: 'Diretrizes gerais de design, boas práticas e geradores de novos agentes.',
      skills: []
    }
  };

  for (const s of skillsList) {
    if (pipelineSlugs.includes(s.slug)) {
      categories.pipeline.skills.push(s);
    } else if (reviewSlugs.includes(s.slug)) {
      categories.review.skills.push(s);
    } else {
      categories.general.skills.push(s);
    }
  }

  // Sort within categories alphabetically or by spec-to-pr number
  const sortSkills = (a, b) => {
    const getNum = (slug) => {
      const match = slug.match(/^(\d+)-/);
      return match ? parseInt(match[1], 10) : 999;
    };
    const numA = getNum(a.slug);
    const numB = getNum(b.slug);
    if (numA !== numB) return numA - numB;
    return a.name.localeCompare(b.name);
  };

  categories.pipeline.skills.sort(sortSkills);
  categories.review.skills.sort(sortSkills);
  categories.general.skills.sort(sortSkills);

  let catalogHtml = '';

  for (const [key, cat] of Object.entries(categories)) {
    if (cat.skills.length === 0) continue;
    catalogHtml += `  <!-- Category: ${cat.title} -->\n`;
    catalogHtml += `  <div class="layer">\n`;
    catalogHtml += `    <h3>${cat.title} <span class="count">(${cat.skills.length})</span></h3>\n`;
    catalogHtml += `    <p class="layer-desc" style="color:var(--text-muted);font-size:0.875rem;margin-bottom:16px;">${cat.description}</p>\n`;
    catalogHtml += `    <div class="skill-grid">\n`;
    for (const sk of cat.skills) {
      catalogHtml += `      <div class="skill-card" data-path="${sk.path}">\n`;
      catalogHtml += `        <div class="name">${sk.name}</div>\n`;
      catalogHtml += `        <div class="desc">${sk.description}</div>\n`;
      catalogHtml += `        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:auto;">\n`;
      catalogHtml += `          <a class="view-skill" href="#" data-path="${sk.path}">View skill</a>\n`;
      catalogHtml += `          <span style="font-family:var(--font-mono);font-size:0.7rem;color:var(--text-muted)">v${sk.version}</span>\n`;
      catalogHtml += `        </div>\n`;
      catalogHtml += `      </div>\n`;
    }
    catalogHtml += `    </div>\n`;
    catalogHtml += `  </div>\n`;
  }

  const indexPath = path.join(root, 'docs', 'index.html');
  if (!fs.existsSync(indexPath)) {
    console.error(`docs/index.html template not found at ${indexPath}`);
    process.exit(1);
  }

  let html = fs.readFileSync(indexPath, 'utf-8');

  // Replace catalog content
  const catStart = html.indexOf('<section id="catalog">');
  const catEnd = html.indexOf('</section>', catStart) + '</section>'.length;
  if (catStart !== -1 && catEnd !== -1) {
    const newSection = `<section id="catalog">\n  <h2>Skill Catalog</h2>\n\n${catalogHtml}</section>`;
    html = html.slice(0, catStart) + newSection + html.slice(catEnd);
  }

  // Update total skills badge
  const totalSkills = skillsList.length;
  html = html.replace(
    /(<span class="badge">)\d+( skills<\/span>)/,
    `$1${totalSkills}$2`
  );

  fs.writeFileSync(indexPath, html);
  console.log(`✅ Site updated successfully! Registered ${totalSkills} skills.`);
}

main();
