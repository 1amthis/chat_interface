import { READ_SKILL_TOOL_NAME } from './constants.ts';

export interface SkillPromptEntry {
  name: string;
  description: string;
  hasAdditionalFiles: boolean;
}

export function buildSkillsSystemPrompt(skills: SkillPromptEntry[] | undefined): string | undefined {
  if (!skills || skills.length === 0) {
    return undefined;
  }

  const lines = [
    '## Project Skills',
    '',
    'The current project exposes reusable skills from `.claude/skills`.',
    '',
    'Available skills:',
    ...skills.map((skill) => `- \`${skill.name}\`: ${skill.description}${skill.hasAdditionalFiles ? ' (includes additional files)' : ''}`),
    '',
    'Rules:',
    `- Before applying a skill, call \`${READ_SKILL_TOOL_NAME}\` with the exact \`skill_name\` to load \`SKILL.md\`.`,
    `- If the skill instructions reference companion files, call \`${READ_SKILL_TOOL_NAME}\` again with \`relative_path\`.`,
    '- Only use a skill when it is directly relevant to the user request.',
    '- Never invent skills that are not listed above.',
  ];

  return lines.join('\n');
}
