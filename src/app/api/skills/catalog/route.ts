import { NextRequest, NextResponse } from 'next/server';
import { validateCSRF } from '@/lib/mcp/server-config';
import { discoverProjectSkills } from '@/lib/skills';

export const dynamic = 'force-dynamic';

interface SkillsCatalogRequest {
  workspaceRoot?: string;
  skillsEnabled?: boolean;
}

export async function POST(request: NextRequest) {
  if (!validateCSRF(request)) {
    return NextResponse.json(
      { error: 'CSRF validation failed: request must originate from the application' },
      { status: 403 }
    );
  }

  try {
    const body = (await request.json()) as SkillsCatalogRequest;
    const { workspaceRoot, skillsEnabled } = body;

    if (!skillsEnabled || !workspaceRoot?.trim()) {
      return NextResponse.json({ skills: [] });
    }

    const skills = await discoverProjectSkills(workspaceRoot.trim());
    return NextResponse.json({ skills });
  } catch (error) {
    return NextResponse.json(
      {
        skills: [],
        error: error instanceof Error ? error.message : 'Failed to discover project skills.',
      },
      { status: 200 }
    );
  }
}
