import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import test from 'node:test';

import {
  discoverProjectSkills,
  readProjectSkillFile,
} from './index.ts';
import { buildSkillsSystemPrompt } from './prompt.ts';

async function createWorkspace(): Promise<string> {
  return mkdtemp('/tmp/opus-skills-');
}

async function createSkill(
  workspaceRoot: string,
  skillName: string,
  content: string,
  extraFiles: Record<string, string> = {}
): Promise<string> {
  const skillDir = path.join(workspaceRoot, '.claude', 'skills', skillName);
  await mkdir(skillDir, { recursive: true });
  await writeFile(path.join(skillDir, 'SKILL.md'), content, 'utf8');

  for (const [relativePath, fileContent] of Object.entries(extraFiles)) {
    const targetPath = path.join(skillDir, relativePath);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, fileContent, 'utf8');
  }

  return skillDir;
}

test('discoverProjectSkills returns valid skills with descriptions and additional file markers', async () => {
  const workspaceRoot = await createWorkspace();

  try {
    await createSkill(
      workspaceRoot,
      'release-notes',
      '# Release notes\n\nSummarize recent changes into concise release notes.',
      { 'template.md': 'extra' }
    );
    await createSkill(
      workspaceRoot,
      'postmortem',
      '# Incident review\n\nCreate a blameless postmortem with timeline, impact, and action items.'
    );

    const skills = await discoverProjectSkills(workspaceRoot);

    assert.deepEqual(skills, [
      {
        name: 'postmortem',
        description: 'Create a blameless postmortem with timeline, impact, and action items.',
        hasAdditionalFiles: false,
      },
      {
        name: 'release-notes',
        description: 'Summarize recent changes into concise release notes.',
        hasAdditionalFiles: true,
      },
    ]);
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test('discoverProjectSkills returns an empty list when the workspace has no skills directory', async () => {
  const workspaceRoot = await createWorkspace();

  try {
    const skills = await discoverProjectSkills(workspaceRoot);
    assert.deepEqual(skills, []);
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test('discoverProjectSkills ignores YAML frontmatter when extracting descriptions', async () => {
  const workspaceRoot = await createWorkspace();

  try {
    await createSkill(
      workspaceRoot,
      'release-notes',
      [
        '---',
        'name: release-notes',
        'description: Draft release notes from change summaries.',
        '---',
        '',
        '# Release notes',
        '',
        'Summarize recent changes into concise release notes.',
      ].join('\n')
    );

    const skills = await discoverProjectSkills(workspaceRoot);

    assert.deepEqual(skills, [
      {
        name: 'release-notes',
        description: 'Summarize recent changes into concise release notes.',
        hasAdditionalFiles: false,
      },
    ]);
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test('discoverProjectSkills skips symlinked skill directories that escape the workspace', async () => {
  const workspaceRoot = await createWorkspace();
  const outsideRoot = await createWorkspace();

  try {
    const skillsRoot = path.join(workspaceRoot, '.claude', 'skills');
    const outsideSkillDir = await createSkill(
      outsideRoot,
      'outside-skill',
      '# Outside\n\nThis skill should not be visible because it lives outside the workspace.'
    );

    await mkdir(skillsRoot, { recursive: true });
    await symlink(outsideSkillDir, path.join(skillsRoot, 'outside-skill'));

    const skills = await discoverProjectSkills(workspaceRoot);
    assert.deepEqual(skills, []);
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
    await rm(outsideRoot, { recursive: true, force: true });
  }
});

test('readProjectSkillFile reads SKILL.md by default and companion files on demand', async () => {
  const workspaceRoot = await createWorkspace();

  try {
    await createSkill(
      workspaceRoot,
      'release-notes',
      '# Release notes\n\nStart with the template before drafting.',
      { 'templates/default.md': '## Template\n\n- Highlights\n- Fixes' }
    );

    const mainFile = await readProjectSkillFile(workspaceRoot, 'release-notes');
    assert.equal(mainFile.relativePath, 'SKILL.md');
    assert.match(mainFile.content, /Start with the template/);
    assert.equal(mainFile.hasAdditionalFiles, true);

    const templateFile = await readProjectSkillFile(
      workspaceRoot,
      'release-notes',
      'templates/default.md'
    );
    assert.equal(templateFile.relativePath, 'templates/default.md');
    assert.match(templateFile.content, /## Template/);
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test('readProjectSkillFile rejects directory traversal outside the skill directory', async () => {
  const workspaceRoot = await createWorkspace();

  try {
    await createSkill(workspaceRoot, 'release-notes', '# Release notes\n\nDraft a release summary.');

    await assert.rejects(
      readProjectSkillFile(workspaceRoot, 'release-notes', '../secrets.txt'),
      /must stay within the skill directory/
    );
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test('buildSkillsSystemPrompt advertises discovered skills and read_skill usage', () => {
  const prompt = buildSkillsSystemPrompt([
    {
      name: 'release-notes',
      description: 'Draft release notes from recent changes.',
      hasAdditionalFiles: true,
    },
  ]);

  assert.ok(prompt);
  assert.match(prompt!, /## Project Skills/);
  assert.match(prompt!, /release-notes/);
  assert.match(prompt!, /read_skill/);
  assert.match(prompt!, /additional files/);
});
