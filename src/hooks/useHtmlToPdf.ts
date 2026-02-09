import { useState, useCallback, RefObject } from 'react';
import type { PdfExportOptions } from '@/types';

interface UseHtmlToPdfReturn {
  downloadPdf: () => Promise<void>;
  isGenerating: boolean;
  error: string | null;
}

export function useHtmlToPdf(
  iframeRef: RefObject<HTMLIFrameElement | null>,
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

      // Access iframe content
      const iframe = iframeRef.current;
      if (!iframe) {
        throw new Error('Iframe reference not available');
      }

      // Wait for iframe to be fully loaded
      await new Promise(resolve => setTimeout(resolve, 500));

      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) {
        throw new Error('Cannot access iframe content');
      }

      const element = iframeDoc.documentElement;
      if (!element) {
        throw new Error('Iframe content is not available');
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
      await html2pdf()
        .set(options)
        .from(element)
        .save();

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate PDF';
      setError(errorMessage);
      console.error('PDF generation error:', err);
      throw err; // Re-throw so caller can handle
    } finally {
      setIsGenerating(false);
    }
  }, [iframeRef, filename]);

  return {
    downloadPdf,
    isGenerating,
    error,
  };
}
