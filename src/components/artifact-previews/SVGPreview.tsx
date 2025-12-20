'use client';

import { useMemo } from 'react';
import DOMPurify from 'dompurify';

interface SVGPreviewProps {
  content: string;
}

export function SVGPreview({ content }: SVGPreviewProps) {
  const sanitizedSVG = useMemo(() => {
    // Configure DOMPurify to only allow SVG-related elements
    const config = {
      USE_PROFILES: { svg: true, svgFilters: true },
      ADD_TAGS: ['use'],
      ADD_ATTR: ['xlink:href', 'href'],
    };
    return DOMPurify.sanitize(content, config);
  }, [content]);

  return (
    <div className="h-full overflow-auto flex items-center justify-center p-4 bg-white dark:bg-gray-100">
      <div
        className="artifact-svg-preview max-w-full"
        dangerouslySetInnerHTML={{ __html: sanitizedSVG }}
      />
    </div>
  );
}
