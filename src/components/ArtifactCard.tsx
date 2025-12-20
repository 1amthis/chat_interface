'use client';

import { Artifact, ArtifactType } from '@/types';

interface ArtifactCardProps {
  artifact: Artifact;
  onClick: (artifactId: string) => void;
}

const ARTIFACT_ICONS: Record<ArtifactType, React.ReactNode> = {
  code: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  ),
  html: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  react: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="2.5" />
      <ellipse cx="12" cy="12" rx="10" ry="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <ellipse cx="12" cy="12" rx="10" ry="4" fill="none" stroke="currentColor" strokeWidth="1.5" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="10" ry="4" fill="none" stroke="currentColor" strokeWidth="1.5" transform="rotate(120 12 12)" />
    </svg>
  ),
  markdown: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  svg: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  mermaid: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
    </svg>
  ),
};

const ARTIFACT_TYPE_LABELS: Record<ArtifactType, string> = {
  code: 'Code',
  html: 'HTML',
  react: 'React',
  markdown: 'Markdown',
  svg: 'SVG',
  mermaid: 'Diagram',
};

export function ArtifactCard({ artifact, onClick }: ArtifactCardProps) {
  return (
    <button
      onClick={() => onClick(artifact.id)}
      className="artifact-card w-full text-left"
    >
      <div className="flex items-center gap-3 text-[var(--foreground)]">
        {ARTIFACT_ICONS[artifact.type]}
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{artifact.title}</p>
          {artifact.language && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {artifact.language}
            </p>
          )}
        </div>
        <span className={`artifact-badge artifact-badge-${artifact.type}`}>
          {ARTIFACT_TYPE_LABELS[artifact.type]}
        </span>
      </div>
    </button>
  );
}
