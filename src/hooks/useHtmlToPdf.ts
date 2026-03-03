import { useState, useCallback } from 'react';
import type { PdfExportOptions } from '@/types';

interface UseHtmlToPdfReturn {
  downloadPdf: () => Promise<void>;
  isGenerating: boolean;
  error: string | null;
}

export function useHtmlToPdf(
  htmlContent: string | null | undefined,
  filename: string
): UseHtmlToPdfReturn {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const downloadPdf = useCallback(async () => {
    setError(null);
    setIsGenerating(true);

    try {
      // Dynamically import html2pdf.js to prevent SSR issues and reduce initial bundle
      const html2pdf = (await import('html2pdf.js')).default;

      if (!htmlContent) {
        throw new Error('HTML content is not available');
      }

      // Build a sanitized, temporary document for PDF export.
      // We intentionally strip scripts/event handlers to avoid executing untrusted artifact code.
      const parser = new DOMParser();
      const parsed = parser.parseFromString(htmlContent, 'text/html');
      parsed.querySelectorAll('script').forEach((el) => el.remove());
      parsed.querySelectorAll('*').forEach((el) => {
        for (const attr of Array.from(el.attributes)) {
          const name = attr.name.toLowerCase();
          const value = attr.value.trim().toLowerCase();
          if (name.startsWith('on')) {
            el.removeAttribute(attr.name);
          } else if ((name === 'href' || name === 'src') && value.startsWith('javascript:')) {
            el.removeAttribute(attr.name);
          }
        }
      });

      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.left = '-99999px';
      iframe.style.top = '0';
      iframe.style.width = '1024px';
      iframe.style.height = '768px';
      iframe.style.opacity = '0';
      iframe.style.pointerEvents = 'none';
      iframe.setAttribute('aria-hidden', 'true');

      const doctype = '<!DOCTYPE html>';
      iframe.srcdoc = `${doctype}${parsed.documentElement.outerHTML}`;
      document.body.appendChild(iframe);

      await new Promise<void>((resolve, reject) => {
        iframe.onload = () => resolve();
        iframe.onerror = () => reject(new Error('Failed to initialize HTML export document'));
      });

      const iframeDoc = iframe.contentDocument;
      const element = iframeDoc?.documentElement;
      if (!iframeDoc || !element) {
        iframe.remove();
        throw new Error('Cannot access temporary HTML export document');
      }

      // Configure PDF options with better page break handling
      const options: Partial<PdfExportOptions> = {
        margin: 10,
        filename: `${filename}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          logging: false,
          backgroundColor: '#ffffff',
          removeContainer: true,
          imageTimeout: 15000,
          foreignObjectRendering: false,
          windowWidth: element.scrollWidth,
          windowHeight: element.scrollHeight,
        },
        jsPDF: {
          unit: 'mm',
          format: 'a4',
          orientation: 'portrait',
        },
        pagebreak: {
          mode: ['avoid-all', 'css', 'legacy'],
          before: '.page-break-before',
          after: '.page-break-after',
          avoid: ['img', 'pre', 'code', 'table', 'tr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
        },
      };

      // Generate and download PDF using documentElement
      try {
        await html2pdf()
          .set(options)
          .from(element)
          .save();
      } finally {
        iframe.remove();
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate PDF';
      setError(errorMessage);
      console.error('PDF generation error:', err);
      throw err; // Re-throw so caller can handle
    } finally {
      setIsGenerating(false);
    }
  }, [htmlContent, filename]);

  return {
    downloadPdf,
    isGenerating,
    error,
  };
}
