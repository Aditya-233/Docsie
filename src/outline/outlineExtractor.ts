/**
 * Document Outline Extractor and Live Statistics Engine
 * for Google Docs Clone.
 */

import type { HeadingItem } from '../types/index.ts';

export function slugifyHeading(text: string, existingSlugs: Set<string> | string[] = new Set()): string {
  const seen = existingSlugs instanceof Set ? existingSlugs : new Set(existingSlugs || []);
  let base = (text || '')
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

  if (!base) {
    base = 'section';
  }

  let slug = base;
  let counter = 1;
  while (seen.has(slug)) {
    slug = `${base}-${counter}`;
    counter++;
  }

  seen.add(slug);
  return slug;
}

export function stripHtmlTags(html: string): string {
  if (!html) return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

export function extractHeadings(source: any, options: { maxLevel?: number; defaultTitle?: string } = {}): HeadingItem[] {
  const maxLevel = options.maxLevel || 3;
  const defaultTitle = options.defaultTitle || 'Untitled section';
  const headings: any[] = [];
  const existingSlugs = new Set<string>();

  if (!source) return headings;

  if (typeof HTMLElement !== 'undefined' && (source instanceof HTMLElement || source.nodeType === 1)) {
    const selector = Array.from({ length: maxLevel }, (_, i) => `h${i + 1}`).join(', ');
    const elements = source.querySelectorAll(selector);

    elements.forEach((el: any, index: number) => {
      const tagName = el.tagName.toLowerCase();
      const level = parseInt(tagName.replace('h', ''), 10);
      const rawText = el.innerText || el.textContent || '';
      const text = rawText.trim() || defaultTitle;

      let anchorId = el.id || el.getAttribute('data-anchor-id');
      if (!anchorId) {
        anchorId = slugifyHeading(text, existingSlugs);
        el.id = anchorId;
        el.setAttribute('data-anchor-id', anchorId);
      } else {
        existingSlugs.add(anchorId);
      }

      headings.push({
        id: anchorId,
        text,
        level,
        tagName,
        index,
        slug: anchorId,
        element: el
      });
    });

    return headings;
  }

  if (typeof source === 'object' && source.root) {
    return extractHeadings(source.root, options);
  }

  if (typeof source === 'string') {
    const headingRegex = /<(h[1-6])(?:\s+[^>]*)?>([\s\S]*?)<\/\1>/gi;
    let match;
    let index = 0;

    while ((match = headingRegex.exec(source)) !== null) {
      const tagName = match[1].toLowerCase();
      const level = parseInt(tagName.replace('h', ''), 10);

      if (level <= maxLevel) {
        const text = stripHtmlTags(match[2]).trim() || defaultTitle;
        const anchorId = slugifyHeading(text, existingSlugs);

        headings.push({
          id: anchorId,
          text,
          level,
          tagName,
          slug: anchorId,
          index: index++
        });
      }
    }
  }

  return headings;
}

export function buildHeadingTree(flatHeadings: any[] = []): any[] {
  if (!Array.isArray(flatHeadings) || flatHeadings.length === 0) {
    return [];
  }

  const rootNodes: any[] = [];
  const stack: { level: number; node: any }[] = [];

  for (const heading of flatHeadings) {
    const node = {
      ...heading,
      children: []
    };

    while (stack.length > 0 && stack[stack.length - 1].level >= node.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      rootNodes.push(node);
    } else {
      stack[stack.length - 1].node.children.push(node);
    }

    stack.push({ level: node.level, node });
  }

  return rootNodes;
}

export function extractOutline(source: any, options: { maxLevel?: number } = {}) {
  const headings = extractHeadings(source, options);
  const tree = buildHeadingTree(headings);
  return {
    headings,
    tree,
    count: headings.length
  };
}

export function calculateStats(source: any, options: { wordsPerMinute?: number; speakingWordsPerMinute?: number } = {}) {
  const wpm = options.wordsPerMinute || 200;
  const speakingWpm = options.speakingWordsPerMinute || 130;

  let plainText = '';
  let paragraphCount = 0;

  if (typeof source === 'string') {
    if (/<[a-z][\s\S]*>/i.test(source)) {
      const blockMatches = source.match(/<(p|h[1-6]|li|blockquote)[^>]*>([\s\S]*?)<\/\1>/gi);
      if (blockMatches) {
        paragraphCount = blockMatches.filter(b => stripHtmlTags(b).trim().length > 0).length;
      }
      plainText = stripHtmlTags(source);
    } else {
      plainText = source;
    }
  } else if (source && typeof source.getText === 'function') {
    plainText = source.getText();
  } else if (typeof HTMLElement !== 'undefined' && (source instanceof HTMLElement || source?.nodeType === 1)) {
    const paragraphs = source.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote');
    paragraphCount = Array.from(paragraphs).filter((p: any) => (p.innerText || p.textContent || '').trim().length > 0).length;
    plainText = (source as any).innerText || (source as any).textContent || '';
  } else if (source && typeof source === 'object' && source.root) {
    plainText = source.root.innerText || source.root.textContent || '';
  }

  const trimmed = plainText.trim();
  const wordsArray = trimmed ? trimmed.split(/\s+/u).filter(w => w.length > 0) : [];
  const words = wordsArray.length;

  const characters = plainText.length;
  const charactersNoSpaces = plainText.replace(/\s/g, '').length;

  if (paragraphCount === 0 && trimmed.length > 0) {
    paragraphCount = trimmed.split(/\n+/).filter(p => p.trim().length > 0).length;
  }

  const lines = trimmed.length > 0 ? plainText.split(/\r\n|\r|\n/).length : 0;

  const rawReadingMinutes = words > 0 ? words / wpm : 0;
  const readingTimeMinutes = words > 0 ? Math.max(1, Math.ceil(rawReadingMinutes)) : 0;
  const readingTimeFormatted = words === 0
    ? '0 min'
    : rawReadingMinutes < 1
      ? '< 1 min'
      : `${readingTimeMinutes} min`;

  const rawSpeakingMinutes = words > 0 ? words / speakingWpm : 0;
  const speakingTimeMinutes = words > 0 ? Math.max(1, Math.ceil(rawSpeakingMinutes)) : 0;
  const speakingTimeFormatted = words === 0
    ? '0 min'
    : rawSpeakingMinutes < 1
      ? '< 1 min'
      : `${speakingTimeMinutes} min`;

  const pagesEstimate = words > 0 ? Math.max(1, Math.ceil(words / 500)) : 1;

  return {
    words,
    characters,
    charactersNoSpaces,
    paragraphs: Math.max(paragraphCount, words > 0 ? 1 : 0),
    lines,
    readingTimeMinutes,
    readingTimeFormatted,
    speakingTimeMinutes,
    speakingTimeFormatted,
    pagesEstimate
  };
}

export class OutlineExtractor {
  public maxLevel: number;
  public wordsPerMinute: number;

  constructor(options: { maxLevel?: number; wordsPerMinute?: number } = {}) {
    this.maxLevel = options.maxLevel || 3;
    this.wordsPerMinute = options.wordsPerMinute || 200;
  }

  extractHeadings(source: any) {
    return extractHeadings(source, { maxLevel: this.maxLevel });
  }

  buildHeadingTree(headings: any[]) {
    return buildHeadingTree(headings);
  }

  extractOutline(source: any) {
    return extractOutline(source, { maxLevel: this.maxLevel });
  }

  calculateStats(source: any) {
    return calculateStats(source, { wordsPerMinute: this.wordsPerMinute });
  }
}
