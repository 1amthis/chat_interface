'use client';

import { useMemo, useState } from 'react';
import { transform } from 'sucrase';

interface ReactPreviewProps {
  content: string;
}

export function ReactPreview({ content }: ReactPreviewProps) {
  const [error, setError] = useState<string | null>(null);

  const htmlContent = useMemo(() => {
    try {
      setError(null);

      // Transpile only JSX, not imports/exports
      const result = transform(content, {
        transforms: ['jsx'],
        jsxRuntime: 'classic',
        jsxPragma: 'React.createElement',
        jsxFragmentPragma: 'React.Fragment',
      });

      // Remove any import/export statements and extract component
      let processedCode = result.code;

      // Remove import statements (they won't work in browser anyway)
      processedCode = processedCode.replace(/^import\s+.*?['"]\s*;?\s*$/gm, '');

      // Convert "export default function X" to "function X"
      processedCode = processedCode.replace(/export\s+default\s+function\s+(\w+)/g, 'function $1');

      // Convert "export default X" to just remove it (we'll find the component by name)
      processedCode = processedCode.replace(/export\s+default\s+(\w+)\s*;?/g, '');

      // Convert "export function X" to "function X"
      processedCode = processedCode.replace(/export\s+function\s+/g, 'function ');

      // Convert "export const X" to "const X"
      processedCode = processedCode.replace(/export\s+const\s+/g, 'const ');

      // Create an HTML document that loads React from CDN and runs the component
      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></script>
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
  <div id="root"></div>
  <script>
    try {
      // User code
      ${processedCode}

      // Try to find a component - check common names
      let Component = null;
      if (typeof App !== 'undefined') Component = App;
      else if (typeof Main !== 'undefined') Component = Main;
      else if (typeof Root !== 'undefined') Component = Root;
      else if (typeof Example !== 'undefined') Component = Example;
      else if (typeof Demo !== 'undefined') Component = Demo;
      else if (typeof Counter !== 'undefined') Component = Counter;
      else if (typeof Button !== 'undefined') Component = Button;
      else if (typeof Card !== 'undefined') Component = Card;
      else if (typeof Form !== 'undefined') Component = Form;
      else if (typeof List !== 'undefined') Component = List;
      else if (typeof MyComponent !== 'undefined') Component = MyComponent;

      if (Component) {
        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(React.createElement(Component));
      } else {
        document.getElementById('root').innerHTML = '<p style="color: #666;">No component found. Define a function component named App, Main, Example, or another common name.</p>';
      }
    } catch (error) {
      document.getElementById('root').innerHTML = '<pre style="color: red; white-space: pre-wrap;">' + error.message + '</pre>';
    }
  </script>
</body>
</html>`;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Transpilation failed';
      setError(message);
      return '';
    }
  }, [content]);

  if (error) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-500 font-medium mb-2">Failed to compile React code</p>
          <pre className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 p-2 rounded max-w-md overflow-auto whitespace-pre-wrap">
            {error}
          </pre>
        </div>
      </div>
    );
  }

  return (
    <iframe
      srcDoc={htmlContent}
      sandbox="allow-scripts"
      className="w-full h-full border-none bg-white"
      title="React Preview"
      referrerPolicy="no-referrer"
    />
  );
}
