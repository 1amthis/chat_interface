'use client';

import { Artifact } from '@/types';
import { CodePreview } from './artifact-previews/CodePreview';
import { MarkdownPreview } from './artifact-previews/MarkdownPreview';
import { HTMLPreview } from './artifact-previews/HTMLPreview';
import { SVGPreview } from './artifact-previews/SVGPreview';
import { MermaidPreview } from './artifact-previews/MermaidPreview';
import { PresentationPreview } from './artifact-previews/PresentationPreview';
import { DocumentPreview } from './artifact-previews/DocumentPreview';

interface ArtifactPreviewProps {
  artifact: Artifact;
  versionIndex?: number; // If provided, show a specific version
}

export function ArtifactPreview({ artifact, versionIndex }: ArtifactPreviewProps) {
  // Use version content if specified, otherwise current content
  const content =
    versionIndex !== undefined && artifact.versions[versionIndex]
      ? artifact.versions[versionIndex].content
      : artifact.content;

  switch (artifact.type) {
    case 'code':
      return <CodePreview content={content} language={artifact.language} />;

    case 'markdown':
      return <MarkdownPreview content={content} />;

    case 'html':
      return <HTMLPreview content={content} />;

    case 'svg':
      return <SVGPreview content={content} />;

    case 'mermaid':
      return <MermaidPreview content={content} />;

    case 'react':
      // React runtime preview is disabled for now due to instability.
      return <CodePreview content={content} language={artifact.language || 'jsx'} />;

    case 'document':
      return <DocumentPreview content={content} />;

    case 'spreadsheet':
      return <CodePreview content={content} language="csv" />;

    case 'presentation':
      return <PresentationPreview content={content} />;

    default:
      return (
        <div className="h-full flex items-center justify-center p-4">
          <p className="text-gray-500">
            Unsupported artifact type: {(artifact as Artifact).type}
          </p>
        </div>
      );
  }
}
