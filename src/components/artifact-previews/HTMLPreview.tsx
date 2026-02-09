'use client';

import { useMemo, forwardRef } from 'react';

interface HTMLPreviewProps {
  content: string;
  onLoad?: () => void;
}

export const HTMLPreview = forwardRef<HTMLIFrameElement, HTMLPreviewProps>(
  ({ content, onLoad }, ref) => {
  // Wrap content in a basic HTML structure if it doesn't have one
  const fullHTML = useMemo(() => {
    const hasHtmlTag = /<html/i.test(content);
    const hasBodyTag = /<body/i.test(content);

    if (hasHtmlTag) {
      return content;
    }

    if (hasBodyTag) {
      return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>${content}</html>`;
    }

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
  </style>
</head>
<body>
${content}
</body>
</html>`;
  }, [content]);

  return (
    <iframe
      ref={ref}
      srcDoc={fullHTML}
      sandbox="allow-scripts allow-same-origin"
      className="w-full h-full border-none bg-white"
      title="HTML Preview"
      referrerPolicy="no-referrer"
      onLoad={onLoad}
    />
  );
});

HTMLPreview.displayName = 'HTMLPreview';
