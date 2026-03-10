import { promises as fs } from 'fs';
import * as path from 'path';

export interface SkillCatalogEntry {
  name: string;
  description: string;
  hasAdditionalFiles: boolean;
}

export interface ReadSkillFileResult {
  skillName: string;
  relativePath: string;
  content: string;
  hasAdditionalFiles: boolean;
}

const SKILLS_DIR_SEGMENTS = ['.claude', 'skills'] as const;
const DEFAULT_SKILL_FILE = 'SKILL.md';
const MAX_SKILL_FILE_BYTES = 128 * 1024;
const MAX_SKILL_DESCRIPTION_CHARS = 240;

function isPathWithin(parent: string, target: string): boolean {
  const relative = path.relative(parent, target);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

async function resolveExistingDirectory(targetPath: string): Promise<string> {
  if (!path.isAbsolute(targetPath)) {
    throw new Error('Workspace root must be an absolute path.');
  }

  const realTarget = await fs.realpath(targetPath);
  const stats = await fs.stat(realTarget);
  if (!stats.isDirectory()) {
    throw new Error('Workspace root must point to a directory.');
  }

  return realTarget;
}

async function getSkillsRoot(workspaceRoot: string): Promise<string | null> {
  const realWorkspaceRoot = await resolveExistingDirectory(workspaceRoot);
  const skillsRootPath = path.join(realWorkspaceRoot, ...SKILLS_DIR_SEGMENTS);

  try {
    const stats = await fs.stat(skillsRootPath);
    if (!stats.isDirectory()) {
      return null;
    }
  } catch {
    return null;
  }

  const realSkillsRoot = await fs.realpath(skillsRootPath);
  if (!isPathWithin(realWorkspaceRoot, realSkillsRoot)) {
    return null;
  }

  return realSkillsRoot;
}

function sanitizeRequestedRelativePath(relativePath?: string): string {
  const nextPath = (relativePath || DEFAULT_SKILL_FILE).trim();
  if (!nextPath) {
    return DEFAULT_SKILL_FILE;
  }

  if (path.isAbsolute(nextPath)) {
    throw new Error('Skill file path must be relative.');
  }

  const normalized = path.posix.normalize(nextPath.replace(/\\/g, '/'));
  if (
    normalized === '..' ||
    normalized.startsWith('../') ||
    normalized.includes('/../') ||
    normalized.startsWith('/') ||
    normalized.includes('\0')
  ) {
    throw new Error('Skill file path must stay within the skill directory.');
  }

  return normalized;
}

async function readUtf8FileLimited(filePath: string): Promise<string> {
  const stats = await fs.stat(filePath);
  if (!stats.isFile()) {
    throw new Error('Skill target must be a file.');
  }
  if (stats.size > MAX_SKILL_FILE_BYTES) {
    throw new Error(`Skill file exceeds ${MAX_SKILL_FILE_BYTES} bytes.`);
  }
  return fs.readFile(filePath, 'utf8');
}

function stripMarkdownNoise(value: string): string {
  return value
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractSkillDescription(content: string): string {
  const paragraphs = content
    .split(/\n\s*\n/)
    .map((part) => stripMarkdownNoise(part))
    .filter((part) => part.length > 0 && !part.startsWith('#'));

  const description = paragraphs[0] || 'No description provided.';
  return description.length > MAX_SKILL_DESCRIPTION_CHARS
    ? `${description.slice(0, MAX_SKILL_DESCRIPTION_CHARS - 1).trimEnd()}...`
    : description;
}

async function resolveSkillDirectory(skillsRoot: string, skillName: string): Promise<string> {
  const candidatePath = path.join(skillsRoot, skillName);
  const realSkillDir = await fs.realpath(candidatePath);
  if (!isPathWithin(skillsRoot, realSkillDir)) {
    throw new Error(`Skill "${skillName}" escapes the skills directory.`);
  }

  const stats = await fs.stat(realSkillDir);
  if (!stats.isDirectory()) {
    throw new Error(`Skill "${skillName}" is not a directory.`);
  }

  return realSkillDir;
}

async function getSkillDirectoryEntries(skillDir: string) {
  return fs.readdir(skillDir, { withFileTypes: true });
}

export async function discoverProjectSkills(workspaceRoot: string): Promise<SkillCatalogEntry[]> {
  const skillsRoot = await getSkillsRoot(workspaceRoot);
  if (!skillsRoot) {
    return [];
  }

  const entries = await fs.readdir(skillsRoot, { withFileTypes: true });
  const skills: SkillCatalogEntry[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) {
      continue;
    }

    try {
      const skillDir = await resolveSkillDirectory(skillsRoot, entry.name);
      const skillFile = path.join(skillDir, DEFAULT_SKILL_FILE);
      const realSkillFile = await fs.realpath(skillFile);
      if (!isPathWithin(skillDir, realSkillFile)) {
        continue;
      }

      const content = await readUtf8FileLimited(realSkillFile);
      const skillEntries = await getSkillDirectoryEntries(skillDir);
      const hasAdditionalFiles = skillEntries.some((skillEntry) => skillEntry.name !== DEFAULT_SKILL_FILE);

      skills.push({
        name: entry.name,
        description: extractSkillDescription(content),
        hasAdditionalFiles,
      });
    } catch {
      continue;
    }
  }

  return skills.sort((left, right) => left.name.localeCompare(right.name));
}

export async function readProjectSkillFile(
  workspaceRoot: string,
  skillName: string,
  relativePath?: string
): Promise<ReadSkillFileResult> {
  const skillsRoot = await getSkillsRoot(workspaceRoot);
  if (!skillsRoot) {
    throw new Error('No project skills directory was found for this workspace.');
  }

  const skillDir = await resolveSkillDirectory(skillsRoot, skillName);
  const normalizedRelativePath = sanitizeRequestedRelativePath(relativePath);
  const targetPath = path.resolve(skillDir, normalizedRelativePath);

  if (!isPathWithin(skillDir, targetPath)) {
    throw new Error('Skill file path must stay within the skill directory.');
  }

  const realTargetPath = await fs.realpath(targetPath);
  if (!isPathWithin(skillDir, realTargetPath)) {
    throw new Error('Skill file path resolves outside the skill directory.');
  }

  const content = await readUtf8FileLimited(realTargetPath);
  const skillEntries = await getSkillDirectoryEntries(skillDir);

  return {
    skillName,
    relativePath: normalizedRelativePath,
    content,
    hasAdditionalFiles: skillEntries.some((skillEntry) => skillEntry.name !== DEFAULT_SKILL_FILE),
  };
}
