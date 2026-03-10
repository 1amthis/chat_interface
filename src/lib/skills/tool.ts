import type { UnifiedTool } from '@/types';
import { READ_SKILL_TOOL_NAME } from './constants.ts';

export function getProjectSkillsTool(): UnifiedTool {
  return {
    source: 'builtin',
    name: READ_SKILL_TOOL_NAME,
    description:
      'Read a project skill file from .claude/skills. Use this before following a discovered skill. Start with SKILL.md, then use relative_path for companion files referenced by the skill.',
    parameters: {
      type: 'object',
      properties: {
        skill_name: {
          type: 'string',
          description: 'Exact skill directory name under .claude/skills.',
        },
        relative_path: {
          type: 'string',
          description: 'Optional relative file path within the selected skill directory. Defaults to SKILL.md.',
        },
      },
      required: ['skill_name'],
    },
  };
}
