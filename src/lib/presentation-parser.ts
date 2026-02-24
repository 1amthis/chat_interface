import { RichPresentation, RichSlide, SlideLayout } from '@/types';
import { parseSlides } from './artifact-export';

function isObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function safeJsonParse(content: string): unknown {
  try {
    return JSON.parse(content.trim());
  } catch {
    return null;
  }
}

function isRichSlide(v: unknown): v is RichSlide {
  if (!isObject(v)) return false;
  // Must have at least one recognizable slide field
  return (
    typeof v.title === 'string' ||
    typeof v.layout === 'string' ||
    Array.isArray(v.bullets) ||
    typeof v.body === 'string' ||
    isObject(v.table) ||
    isObject(v.chart)
  );
}

/**
 * Parse presentation content into a RichPresentation.
 * Tries rich JSON format first, falls back to legacy markdown via parseSlides().
 */
export function parsePresentationContent(content: string, fallbackTitle?: string): RichPresentation {
  const parsed = safeJsonParse(content);

  // Try { theme?, slides: [...] } format
  if (isObject(parsed) && Array.isArray(parsed.slides) && parsed.slides.length > 0) {
    const slides = (parsed.slides as unknown[]).filter(isRichSlide);
    if (slides.length > 0) {
      return {
        theme: isObject(parsed.theme) ? parsed.theme as RichPresentation['theme'] : undefined,
        slides,
      };
    }
  }

  // Try plain array of slides
  if (Array.isArray(parsed) && parsed.length > 0) {
    const slides = (parsed as unknown[]).filter(isRichSlide);
    if (slides.length > 0) {
      return { slides };
    }
  }

  // Fallback: use legacy parseSlides and convert to RichSlide[]
  const title = fallbackTitle || 'Presentation';
  const legacySlides = parseSlides(content, title);
  return {
    slides: legacySlides.map(s => {
      const filteredBullets = s.bullets.filter(b => b.trim());
      const layout: SlideLayout =
        filteredBullets.length === 0 ? 'title' : 'title-content';
      return {
        layout,
        title: s.title,
        subtitle: s.subtitle,
        bullets: filteredBullets.length > 0 ? filteredBullets : undefined,
      };
    }),
  };
}
