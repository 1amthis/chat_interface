'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { parsePresentationContent } from '@/lib/presentation-parser';
import type { RichPresentation, RichSlide, PresentationTheme, SlideBullet, SlideTable, SlideChart } from '@/types';

interface PresentationPreviewProps {
  content: string;
}

function cleanHex(color: string | undefined, fallback: string): string {
  if (!color) return fallback;
  return color.replace(/^#/, '') || fallback;
}

interface ThemeColors {
  background: string;
  titleColor: string;
  bodyColor: string;
  accentColor: string;
  titleFont: string;
  bodyFont: string;
}

function resolveTheme(theme?: PresentationTheme): ThemeColors {
  return {
    background: cleanHex(theme?.background, 'FFFFFF'),
    titleColor: cleanHex(theme?.titleColor, '1A1A2E'),
    bodyColor: cleanHex(theme?.bodyColor, '333333'),
    accentColor: cleanHex(theme?.accentColor, '3B82F6'),
    titleFont: theme?.titleFont ?? 'Arial',
    bodyFont: theme?.bodyFont ?? 'Calibri',
  };
}

function hexToCSS(hex: string): string {
  return `#${hex}`;
}

function BulletList({ bullets, colors }: { bullets: SlideBullet[]; colors: ThemeColors }) {
  return (
    <ul style={{ margin: 0, paddingLeft: '1.5em', listStyleType: 'disc', color: hexToCSS(colors.bodyColor), fontFamily: colors.bodyFont }}>
      {bullets.map((bullet, i) => (
        <li key={i} style={{ marginBottom: '0.35em', fontSize: '0.85em', lineHeight: 1.5 }}>
          {typeof bullet === 'string' ? bullet : bullet.map((run, j) => (
            <span
              key={j}
              style={{
                fontWeight: run.bold ? 700 : undefined,
                fontStyle: run.italic ? 'italic' : undefined,
                color: run.color ? hexToCSS(cleanHex(run.color, colors.bodyColor)) : undefined,
                fontSize: run.fontSize ? `${run.fontSize * 0.5}px` : undefined,
                fontFamily: run.fontFace ?? undefined,
              }}
            >
              {run.text}
            </span>
          ))}
        </li>
      ))}
    </ul>
  );
}

function TablePreview({ table, colors }: { table: SlideTable; colors: ThemeColors }) {
  const headerFill = cleanHex(table.headerFill, colors.accentColor);
  const headerColor = cleanHex(table.headerColor, 'FFFFFF');
  const borderColor = cleanHex(table.borderColor, 'CCCCCC');
  const borderStyle = `1px solid ${hexToCSS(borderColor)}`;

  return (
    <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.65em', fontFamily: colors.bodyFont }}>
      {table.headers && (
        <thead>
          <tr>
            {table.headers.map((h, i) => {
              const text = typeof h === 'string' ? h : h.text;
              return (
                <th key={i} style={{
                  background: hexToCSS(headerFill),
                  color: hexToCSS(headerColor),
                  padding: '4px 8px',
                  border: borderStyle,
                  fontWeight: 600,
                  textAlign: 'center',
                }}>
                  {text}
                </th>
              );
            })}
          </tr>
        </thead>
      )}
      <tbody>
        {table.rows.map((row, ri) => (
          <tr key={ri}>
            {row.map((cell, ci) => {
              const isObj = typeof cell === 'object' && cell !== null;
              const text = isObj ? cell.text : cell;
              return (
                <td key={ci} style={{
                  padding: '3px 8px',
                  border: borderStyle,
                  color: hexToCSS(isObj && cell.color ? cleanHex(cell.color, colors.bodyColor) : colors.bodyColor),
                  background: isObj && cell.fill ? hexToCSS(cleanHex(cell.fill, 'FFFFFF')) : undefined,
                  fontWeight: isObj && cell.bold ? 600 : undefined,
                  textAlign: isObj ? (cell.align ?? 'left') : 'left',
                }}>
                  {text}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ChartPreview({ chart, colors }: { chart: SlideChart; colors: ThemeColors }) {
  const chartColors = chart.chartColors?.map(c => hexToCSS(cleanHex(c, colors.accentColor)))
    ?? [hexToCSS(colors.accentColor), '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

  if (chart.type === 'pie' || chart.type === 'doughnut') {
    const series = chart.data[0];
    if (!series) return null;
    const total = series.values.reduce((a, b) => a + b, 0);
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontFamily: colors.bodyFont }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.6em' }}>
          {series.labels.map((label, i) => {
            const pct = total > 0 ? ((series.values[i] / total) * 100).toFixed(1) : '0';
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: chartColors[i % chartColors.length], flexShrink: 0 }} />
                <span style={{ color: hexToCSS(colors.bodyColor) }}>{label}: {pct}%</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Bar/line/area: show horizontal bars
  const series = chart.data[0];
  if (!series) return null;
  const maxVal = Math.max(...series.values, 1);

  return (
    <div style={{ fontFamily: colors.bodyFont }}>
      {chart.title && <div style={{ fontSize: '0.7em', fontWeight: 600, marginBottom: 6, color: hexToCSS(colors.bodyColor) }}>{chart.title}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {series.labels.map((label, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.6em' }}>
            <span style={{ width: '60px', textAlign: 'right', color: hexToCSS(colors.bodyColor), flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
            <div style={{ flex: 1, height: 16, background: '#f0f0f0', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                width: `${(series.values[i] / maxVal) * 100}%`,
                height: '100%',
                background: chartColors[i % chartColors.length],
                borderRadius: 3,
                transition: 'width 0.3s',
              }} />
            </div>
            <span style={{ fontSize: '0.9em', color: hexToCSS(colors.bodyColor), minWidth: 30 }}>{series.values[i]}</span>
          </div>
        ))}
      </div>
      {chart.showLegend && chart.data.length > 1 && (
        <div style={{ display: 'flex', gap: '8px', marginTop: 6, fontSize: '0.55em' }}>
          {chart.data.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: 8, height: 8, borderRadius: 1, background: chartColors[i % chartColors.length] }} />
              <span style={{ color: hexToCSS(colors.bodyColor) }}>{s.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SlideRenderer({ slide, theme, slideNumber }: { slide: RichSlide; theme: ThemeColors; slideNumber: number }) {
  const layout = slide.layout ?? 'title-content';
  const bg = hexToCSS(cleanHex(slide.background, theme.background));
  const titleColor = hexToCSS(cleanHex(slide.titleColor, theme.titleColor));
  const bodyColor = hexToCSS(cleanHex(slide.bodyColor, theme.bodyColor));
  const accentColor = hexToCSS(theme.accentColor);

  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    background: bg,
    padding: '5% 5%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    fontFamily: theme.bodyFont,
    color: bodyColor,
  };

  if (layout === 'title') {
    return (
      <div style={{ ...containerStyle, justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
        {slide.title && (
          <div style={{ fontSize: '1.8em', fontWeight: 700, color: titleColor, fontFamily: theme.titleFont, marginBottom: '0.3em' }}>
            {slide.title}
          </div>
        )}
        <div style={{ width: '20%', height: 3, background: accentColor, margin: '0.5em auto' }} />
        {slide.subtitle && (
          <div style={{ fontSize: '1em', color: bodyColor, marginTop: '0.3em' }}>
            {slide.subtitle}
          </div>
        )}
      </div>
    );
  }

  if (layout === 'section') {
    const sectionBg = hexToCSS(cleanHex(slide.background, theme.accentColor));
    return (
      <div style={{ ...containerStyle, background: sectionBg, justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
        {slide.title && (
          <div style={{ fontSize: '1.6em', fontWeight: 700, color: '#FFFFFF', fontFamily: theme.titleFont }}>
            {slide.title}
          </div>
        )}
        {slide.subtitle && (
          <div style={{ fontSize: '0.9em', color: 'rgba(255,255,255,0.85)', marginTop: '0.4em' }}>
            {slide.subtitle}
          </div>
        )}
      </div>
    );
  }

  if (layout === 'two-column') {
    return (
      <div style={containerStyle}>
        {slide.title && (
          <div style={{ fontSize: '1.3em', fontWeight: 700, color: titleColor, fontFamily: theme.titleFont, marginBottom: '0.5em' }}>
            {slide.title}
          </div>
        )}
        <div style={{ flex: 1, display: 'flex', gap: '4%', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {slide.bullets && <BulletList bullets={slide.bullets} colors={theme} />}
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {slide.body && <div style={{ fontSize: '0.85em', lineHeight: 1.5 }}>{slide.body}</div>}
            {slide.table && <TablePreview table={slide.table} colors={theme} />}
          </div>
        </div>
      </div>
    );
  }

  if (layout === 'image-left' || layout === 'image-right') {
    const img = slide.images?.[0];
    const imgSrc = img?.data || img?.path;
    const imgElement = imgSrc ? (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <img src={imgSrc} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 4 }} />
      </div>
    ) : (
      <div style={{ flex: 1, background: '#f0f0f0', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: '0.7em' }}>
        Image
      </div>
    );
    const contentElement = (
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {slide.bullets && <BulletList bullets={slide.bullets} colors={theme} />}
        {slide.body && <div style={{ fontSize: '0.85em', lineHeight: 1.5 }}>{slide.body}</div>}
      </div>
    );

    return (
      <div style={containerStyle}>
        {slide.title && (
          <div style={{ fontSize: '1.3em', fontWeight: 700, color: titleColor, fontFamily: theme.titleFont, marginBottom: '0.5em' }}>
            {slide.title}
          </div>
        )}
        <div style={{ flex: 1, display: 'flex', gap: '4%', overflow: 'hidden' }}>
          {layout === 'image-left' ? <>{imgElement}{contentElement}</> : <>{contentElement}{imgElement}</>}
        </div>
      </div>
    );
  }

  // Default: title-content (and blank)
  return (
    <div style={containerStyle}>
      {slide.title && (
        <>
          <div style={{ fontSize: '1.3em', fontWeight: 700, color: titleColor, fontFamily: theme.titleFont, marginBottom: '0.15em' }}>
            {slide.title}
          </div>
          <div style={{ width: '15%', height: 2, background: accentColor, marginBottom: '0.4em' }} />
        </>
      )}
      {slide.subtitle && (
        <div style={{ fontSize: '0.8em', color: bodyColor, fontStyle: 'italic', marginBottom: '0.4em' }}>
          {slide.subtitle}
        </div>
      )}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {slide.bullets && slide.bullets.length > 0 && <BulletList bullets={slide.bullets} colors={theme} />}
        {slide.body && <div style={{ fontSize: '0.85em', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{slide.body}</div>}
        {slide.table && <div style={{ marginTop: '0.5em' }}><TablePreview table={slide.table} colors={theme} /></div>}
        {slide.chart && <div style={{ marginTop: '0.5em' }}><ChartPreview chart={slide.chart} colors={theme} /></div>}
        {slide.images && slide.images.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginTop: '0.5em', flexWrap: 'wrap' }}>
            {slide.images.map((img, i) => {
              const src = img.data || img.path;
              return src ? (
                <img key={i} src={src} alt="" style={{ maxHeight: 120, borderRadius: 4, objectFit: 'contain' }} />
              ) : null;
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function PresentationPreview({ content }: PresentationPreviewProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  const presentation: RichPresentation = useMemo(
    () => parsePresentationContent(content, 'Presentation'),
    [content],
  );

  const theme = useMemo(() => resolveTheme(presentation.theme), [presentation.theme]);
  const slideCount = presentation.slides.length;

  // Reset slide index if content changes and index is out of bounds
  useEffect(() => {
    if (currentSlide >= slideCount) {
      setCurrentSlide(Math.max(0, slideCount - 1));
    }
  }, [slideCount, currentSlide]);

  const goNext = useCallback(() => setCurrentSlide(i => Math.min(i + 1, slideCount - 1)), [slideCount]);
  const goPrev = useCallback(() => setCurrentSlide(i => Math.max(i - 1, 0)), []);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        goPrev();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev]);

  if (slideCount === 0) {
    return <div className="h-full flex items-center justify-center text-gray-400">No slides</div>;
  }

  return (
    <div className="h-full flex flex-col" style={{ minHeight: 0 }}>
      {/* Slide viewport */}
      <div className="flex-1 flex items-center justify-center p-3 overflow-hidden" style={{ minHeight: 0 }}>
        <div
          className="relative w-full max-w-4xl rounded-lg overflow-hidden"
          style={{
            aspectRatio: '16 / 9',
            boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
            border: '1px solid var(--border-color, #e5e7eb)',
          }}
        >
          <SlideRenderer
            slide={presentation.slides[currentSlide]}
            theme={theme}
            slideNumber={currentSlide + 1}
          />
        </div>
      </div>

      {/* Navigation bar */}
      <div className="flex items-center justify-center gap-3 py-2 border-t" style={{ borderColor: 'var(--border-color, #e5e7eb)' }}>
        <button
          onClick={goPrev}
          disabled={currentSlide === 0}
          className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Previous slide"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="text-xs text-gray-500 tabular-nums min-w-[4em] text-center">
          {currentSlide + 1} / {slideCount}
        </span>
        <button
          onClick={goNext}
          disabled={currentSlide === slideCount - 1}
          className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Next slide"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Thumbnail strip */}
      {slideCount > 1 && (
        <div
          className="flex gap-1.5 px-3 pb-2 overflow-x-auto"
          style={{ scrollbarWidth: 'thin' }}
        >
          {presentation.slides.map((slide, i) => (
            <button
              key={i}
              onClick={() => setCurrentSlide(i)}
              className="shrink-0 rounded overflow-hidden transition-all"
              style={{
                width: 80,
                aspectRatio: '16 / 9',
                border: i === currentSlide ? `2px solid ${hexToCSS(theme.accentColor)}` : '2px solid transparent',
                opacity: i === currentSlide ? 1 : 0.7,
                position: 'relative',
              }}
              title={`Slide ${i + 1}${slide.title ? `: ${slide.title}` : ''}`}
            >
              <div style={{ transform: 'scale(0.15)', transformOrigin: 'top left', width: 533, height: 300, position: 'absolute', top: 0, left: 0 }}>
                <SlideRenderer slide={slide} theme={theme} slideNumber={i + 1} />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
