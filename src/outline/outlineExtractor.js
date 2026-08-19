/**
 * Document Outline Extractor and Live Statistics Engine
 * for Google Docs Clone.
 * 
 * Extracts structured heading trees (H1, H2, H3) with anchor IDs and
 * computes real-time statistics (word count, characters, paragraphs, reading time).
 */

/**
 * Generate a clean URL-friendly anchor slug from heading text.
 * @param {string} text - Raw heading text
 * @param {Set<string>|Array<string>} [existingSlugs] - Set of already used slugs to avoid collisions
 * @returns {string} Unique slug
 */
export function slugifyHeading(text, existingSlugs = new Set()) {
  const seen = existingSlugs instanceof Set ? existingSlugs : new Set(existingSlugs || []);
  let base = (text || '')
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // remove non-alphanumeric except whitespace/dash
    .replace(/\s+/g, '-')     // collapse whitespace to dashes
    .replace(/-+/g, '-');     // collapse multiple dashes

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

/**
 * Strip HTML tags from a string and decode basic entities.
 * @param {string} html - HTML string
 * @returns {string} Plain text
 */
export function stripHtmlTags(html) {
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

/**
 * Extract flat list of headings (H1-H6 or H1-H3) from a DOM element or HTML string.
 * @param {HTMLElement|string|object} source - DOM element, Quill editor root, or HTML string
 * @param {object} [options] - Options (maxLevel, defaultTitle)
 * @returns {Array<{ id: string, text: string, level: number, tagName: string, index: number, element?: HTMLElement }>}
 */
export function extractHeadings(source, options = {}) {
  const maxLevel = options.maxLevel || 3; // Default H1-H3
  const defaultTitle = options.defaultTitle || 'Untitled section';
  const headings = [];
  const existingSlugs = new Set();

  if (!source) return headings;

  // 1. DOM Element / HTMLElement input (Browser environment)
  if (typeof HTMLElement !== 'undefined' && (source instanceof HTMLElement || source.nodeType === 1)) {
    const selector = Array.from({ length: maxLevel }, (_, i) => `h${i + 1}`).join(', ');
    const elements = source.querySelectorAll(selector);

    elements.forEach((el, index) => {
      const tagName = el.tagName.toLowerCase();
      const level = parseInt(tagName.replace('h', ''), 10);
      const rawText = el.innerText || el.textContent || '';
      const text = rawText.trim() || defaultTitle;

      // Assign or read anchor ID
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
        element: el
      });
    });

    return headings;
  }

  // 2. Quill-like root wrapper with children or getText fallback
  if (typeof source === 'object' && source.root) {
    return extractHeadings(source.root, options);
  }

  // 3. HTML String input (Node.js or headless parsing)
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
          index: index++
        });
      }
    }
  }

  return headings;
}

/**
 * Transform a flat list of headings into a hierarchical nested tree.
 * @param {Array<object>} flatHeadings - Array of heading objects from extractHeadings
 * @returns {Array<object>} Nested heading tree nodes with children arrays
 */
export function buildHeadingTree(flatHeadings = []) {
  if (!Array.isArray(flatHeadings) || flatHeadings.length === 0) {
    return [];
  }

  const rootNodes = [];
  const stack = []; // Track ancestor chain: [{ level, node }]

  for (const heading of flatHeadings) {
    const node = {
      ...heading,
      children: []
    };

    // Pop stack until finding a parent with a lower level number (e.g. H1 is parent of H2)
    while (stack.length > 0 && stack[stack.length - 1].level >= node.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      // Top-level node for this branch
      rootNodes.push(node);
    } else {
      // Append as child of current parent in stack
      stack[stack.length - 1].node.children.push(node);
    }

    stack.push({ level: node.level, node });
  }

  return rootNodes;
}

/**
 * Extract both flat list and hierarchical tree for document outline.
 * @param {HTMLElement|string|object} source - Document content or element
 * @param {object} [options] - Options
 * @returns {{ headings: Array<object>, tree: Array<object>, count: number }}
 */
export function extractOutline(source, options = {}) {
  const headings = extractHeadings(source, options);
  const tree = buildHeadingTree(headings);
  return {
    headings,
    tree,
    count: headings.length
  };
}

/**
 * Calculate live statistics for document text or HTML content.
 * @param {string|HTMLElement|object} source - Text, HTML string, Quill instance or DOM element
 * @param {object} [options] - Configuration options (wordsPerMinute, speakingWordsPerMinute)
 * @returns {{
 *   words: number,
 *   characters: number,
 *   charactersNoSpaces: number,
 *   paragraphs: number,
 *   lines: number,
 *   readingTimeMinutes: number,
 *   readingTimeFormatted: string,
 *   speakingTimeMinutes: number,
 *   speakingTimeFormatted: string,
 *   pagesEstimate: number
 * }}
 */
export function calculateStats(source, options = {}) {
  const wpm = options.wordsPerMinute || 200;
  const speakingWpm = options.speakingWordsPerMinute || 130;

  let plainText = '';
  let paragraphCount = 0;

  if (typeof source === 'string') {
    // Check if source contains HTML tags
    if (/<[a-z][\s\S]*>/i.test(source)) {
      // Count paragraphs via block tags before stripping
      const blockMatches = source.match(/<(p|h[1-6]|li|blockquote)[^>]*>([\s\S]*?)<\/\1>/gi);
      if (blockMatches) {
        paragraphCount = blockMatches.filter(b => stripHtmlTags(b).trim().length > 0).length;
      }
      plainText = stripHtmlTags(source);
    } else {
      plainText = source;
    }
  } else if (source && typeof source.getText === 'function') {
    // Quill editor instance
    plainText = source.getText();
  } else if (typeof HTMLElement !== 'undefined' && (source instanceof HTMLElement || source?.nodeType === 1)) {
    // DOM Element
    const paragraphs = source.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote');
    paragraphCount = Array.from(paragraphs).filter(p => (p.innerText || p.textContent || '').trim().length > 0).length;
    plainText = source.innerText || source.textContent || '';
  } else if (source && typeof source === 'object' && source.root) {
    plainText = source.root.innerText || source.root.textContent || '';
  }

  // Normalize text
  const trimmed = plainText.trim();

  // Word count: split by unicode whitespace characters
  const wordsArray = trimmed ? trimmed.split(/\s+/u).filter(w => w.length > 0) : [];
  const words = wordsArray.length;

  // Character counts
  const characters = plainText.length;
  const charactersNoSpaces = plainText.replace(/\s/g, '').length;

  // Paragraph count fallback from newlines if not derived from HTML blocks
  if (paragraphCount === 0 && trimmed.length > 0) {
    paragraphCount = trimmed.split(/\n+/).filter(p => p.trim().length > 0).length;
  }

  // Line count
  const lines = trimmed.length > 0 ? plainText.split(/\r\n|\r|\n/).length : 0;

  // Reading time calculations
  const rawReadingMinutes = words > 0 ? words / wpm : 0;
  const readingTimeMinutes = words > 0 ? Math.max(1, Math.ceil(rawReadingMinutes)) : 0;
  const readingTimeFormatted = words === 0
    ? '0 min'
    : rawReadingMinutes < 1
      ? '< 1 min'
      : `${readingTimeMinutes} min`;

  // Speaking time calculations
  const rawSpeakingMinutes = words > 0 ? words / speakingWpm : 0;
  const speakingTimeMinutes = words > 0 ? Math.max(1, Math.ceil(rawSpeakingMinutes)) : 0;
  const speakingTimeFormatted = words === 0
    ? '0 min'
    : rawSpeakingMinutes < 1
      ? '< 1 min'
      : `${speakingTimeMinutes} min`;

  // Estimated pages (industry standard ~ 500 words / page in single spaced standard doc)
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

/**
 * Outline and Stats Extractor Engine class.
 */
export class OutlineExtractor {
  constructor(options = {}) {
    this.maxLevel = options.maxLevel || 3;
    this.wordsPerMinute = options.wordsPerMinute || 200;
  }

  extractHeadings(source) {
    return extractHeadings(source, { maxLevel: this.maxLevel });
  }

  buildHeadingTree(headings) {
    return buildHeadingTree(headings);
  }

  extractOutline(source) {
    return extractOutline(source, { maxLevel: this.maxLevel });
  }

  calculateStats(source) {
    return calculateStats(source, { wordsPerMinute: this.wordsPerMinute });
  }
}
