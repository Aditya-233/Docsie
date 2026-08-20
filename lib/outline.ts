/**
 * Heading hierarchy extraction and live document statistics calculator.
 */

export interface HeadingItem {
  id: string;
  text: string;
  level: number;
  index: number;
  slug: string;
}

export interface HeadingTreeNode extends HeadingItem {
  children: HeadingTreeNode[];
}

export interface DocumentStatsDetailed {
  words: number;
  characters: number;
  charactersNoSpaces: number;
  paragraphs: number;
  lines: number;
  readingTimeMinutes: number;
  readingTimeFormatted: string;
  speakingTimeMinutes: number;
  speakingTimeFormatted: string;
  pagesEstimate: number;
}

/**
 * Generate unique slug from heading text.
 */
export function slugifyHeading(text: string = "", existingSlugs: Set<string> | string[] = new Set()): string {
  const seen = existingSlugs instanceof Set ? existingSlugs : new Set(existingSlugs || []);
  let base = (text || "")
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!base) {
    base = "section";
  }

  let slug = base;
  let counter = 1;
  while (seen.has(slug)) {
    slug = base + "-" + counter;
    counter++;
  }

  seen.add(slug);
  return slug;
}

/**
 * Strip HTML tags and decode common entities.
 */
export function stripHtmlTags(html: string): string {
  if (!html) return "";
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .trim();
}

/**
 * Extract flat heading items from HTML string, DOM element, or Tiptap JSON.
 */
export function extractHeadings(
  source: unknown,
  options: { maxLevel?: number; defaultTitle?: string } = {}
): HeadingItem[] {
  const maxLevel = options.maxLevel || 6;
  const defaultTitle = options.defaultTitle || "Untitled section";
  const headings: HeadingItem[] = [];
  const existingSlugs = new Set<string>();

  if (!source) return headings;

  // 1. DOM / HTMLElement input
  if (
    typeof HTMLElement !== "undefined" &&
    (source instanceof HTMLElement ||
      (source && typeof source === "object" && "nodeType" in source && (source as { nodeType: number }).nodeType === 1))
  ) {
    const elSource = source as HTMLElement;
    const selector = Array.from({ length: maxLevel }, (_, i) => "h" + (i + 1)).join(", ");
    const elements = elSource.querySelectorAll<HTMLElement>(selector);

    elements.forEach((el, index) => {
      const tagName = el.tagName.toLowerCase();
      const level = parseInt(tagName.replace("h", ""), 10);
      const rawText = el.innerText || el.textContent || "";
      const text = rawText.trim() || defaultTitle;

      let anchorId = el.id || el.getAttribute("data-anchor-id");
      if (!anchorId) {
        anchorId = slugifyHeading(text, existingSlugs);
        el.id = anchorId;
        el.setAttribute("data-anchor-id", anchorId);
      } else {
        existingSlugs.add(anchorId);
      }

      headings.push({
        id: anchorId,
        text,
        level,
        index,
        slug: anchorId,
      });
    });

    return headings;
  }

  // 2. Tiptap / ProseMirror JSON input
  if (typeof source === "object" && source !== null && "content" in source && Array.isArray((source as any).content)) {
    let index = 0;
    const processNodes = (nodes: any[]) => {
      for (const node of nodes) {
        if (node.type === "heading") {
          const level = Math.min(Math.max(node.attrs?.level || 1, 1), 6);
          if (level <= maxLevel) {
            const rawText = node.content?.map((c: any) => c.text || "").join("") || "";
            const text = rawText.trim() || defaultTitle;
            const anchorId = node.attrs?.id || slugifyHeading(text, existingSlugs);
            headings.push({
              id: anchorId,
              text,
              level,
              slug: anchorId,
              index: index++,
            });
          }
        }
        if (node.content && Array.isArray(node.content)) {
          processNodes(node.content);
        }
      }
    };
    processNodes((source as any).content);
    return headings;
  }

  // 3. HTML string input
  if (typeof source === "string") {
    const headingRegex = /<(h[1-6])(?:\s+[^>]*)?>([\s\S]*?)<\/\1>/gi;
    let match: RegExpExecArray | null;
    let index = 0;

    while ((match = headingRegex.exec(source)) !== null) {
      const tagName = match[1].toLowerCase();
      const level = parseInt(tagName.replace("h", ""), 10);

      if (level <= maxLevel) {
        const text = stripHtmlTags(match[2]).trim() || defaultTitle;
        const anchorId = slugifyHeading(text, existingSlugs);

        headings.push({
          id: anchorId,
          text,
          level,
          slug: anchorId,
          index: index++,
        });
      }
    }
  }

  return headings;
}

/**
 * Build hierarchical tree from flat heading items.
 */
export function buildHeadingTree(flatHeadings: HeadingItem[] = []): HeadingTreeNode[] {
  if (!Array.isArray(flatHeadings) || flatHeadings.length === 0) {
    return [];
  }

  const rootNodes: HeadingTreeNode[] = [];
  const stack: { level: number; node: HeadingTreeNode }[] = [];

  for (const heading of flatHeadings) {
    const node: HeadingTreeNode = {
      ...heading,
      children: [],
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

/**
 * Extract flat headings and outline tree.
 */
export function extractOutline(source: unknown, options: { maxLevel?: number } = {}) {
  const headings = extractHeadings(source, options);
  const tree = buildHeadingTree(headings);
  return {
    headings,
    tree,
    count: headings.length,
  };
}

/**
 * Calculate live statistics (words, characters, paragraphs, reading/speaking time, pages).
 */
export function calculateStats(
  source: unknown,
  options: { wordsPerMinute?: number; speakingWordsPerMinute?: number } = {}
): DocumentStatsDetailed {
  const wpm = options.wordsPerMinute || 200;
  const speakingWpm = options.speakingWordsPerMinute || 130;

  let plainText = "";
  let paragraphCount = 0;

  if (typeof source === "string") {
    if (/<[a-z][\s\S]*>/i.test(source)) {
      const blockMatches = source.match(/<(p|h[1-6]|li|blockquote)[^>]*>([\s\S]*?)<\/\1>/gi);
      if (blockMatches) {
        paragraphCount = blockMatches.filter((b) => stripHtmlTags(b).trim().length > 0).length;
      }
      plainText = stripHtmlTags(source);
    } else {
      plainText = source;
    }
  } else if (
    source &&
    typeof source === "object" &&
    "content" in source &&
    Array.isArray((source as any).content)
  ) {
    // Tiptap JSON node
    const blocks: string[] = [];
    const extractText = (node: any) => {
      if (node.type === "text" && node.text) {
        return node.text;
      }
      if (node.content && Array.isArray(node.content)) {
        return node.content.map(extractText).join("");
      }
      return "";
    };

    for (const node of (source as any).content) {
      if (node.type === "paragraph" || node.type === "heading" || node.type === "blockquote") {
        const text = extractText(node).trim();
        if (text) {
          blocks.push(text);
          paragraphCount++;
        }
      } else if (node.type === "bulletList" || node.type === "orderedList") {
        if (node.content) {
          for (const item of node.content) {
            const text = extractText(item).trim();
            if (text) {
              blocks.push(text);
              paragraphCount++;
            }
          }
        }
      }
    }
    plainText = blocks.join("\n\n");
  } else if (
    typeof HTMLElement !== "undefined" &&
    (source instanceof HTMLElement ||
      (source && typeof source === "object" && "nodeType" in source && (source as { nodeType: number }).nodeType === 1))
  ) {
    const elSource = source as HTMLElement;
    const paragraphs = elSource.querySelectorAll("p, h1, h2, h3, h4, h5, h6, li, blockquote");
    paragraphCount = Array.from(paragraphs).filter((p) => (p.textContent || "").trim().length > 0).length;
    plainText = elSource.textContent || "";
  }

  const trimmed = plainText.trim();
  const wordsArray = trimmed ? trimmed.split(/\s+/u).filter((w) => w.length > 0) : [];
  const words = wordsArray.length;

  const characters = plainText.length;
  const charactersNoSpaces = plainText.replace(/\s/g, "").length;

  if (paragraphCount === 0 && trimmed.length > 0) {
    paragraphCount = trimmed.split(/\n+/).filter((p) => p.trim().length > 0).length;
  }

  const lines = trimmed.length > 0 ? plainText.split(/\r\n|\r|\n/).length : 0;

  const rawReadingMinutes = words > 0 ? words / wpm : 0;
  const readingTimeMinutes = words > 0 ? Math.max(1, Math.ceil(rawReadingMinutes)) : 0;
  const readingTimeFormatted =
    words === 0 ? "0 min" : rawReadingMinutes < 1 ? "< 1 min" : (readingTimeMinutes + " min");

  const rawSpeakingMinutes = words > 0 ? words / speakingWpm : 0;
  const speakingTimeMinutes = words > 0 ? Math.max(1, Math.ceil(rawSpeakingMinutes)) : 0;
  const speakingTimeFormatted =
    words === 0 ? "0 min" : rawSpeakingMinutes < 1 ? "< 1 min" : (speakingTimeMinutes + " min");

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
    pagesEstimate,
  };
}

export class OutlineExtractor {
  public maxLevel: number;
  public wordsPerMinute: number;

  constructor(options: { maxLevel?: number; wordsPerMinute?: number } = {}) {
    this.maxLevel = options.maxLevel || 6;
    this.wordsPerMinute = options.wordsPerMinute || 200;
  }

  extractHeadings(source: unknown): HeadingItem[] {
    return extractHeadings(source, { maxLevel: this.maxLevel });
  }

  buildHeadingTree(headings: HeadingItem[]): HeadingTreeNode[] {
    return buildHeadingTree(headings);
  }

  extractOutline(source: unknown) {
    return extractOutline(source, { maxLevel: this.maxLevel });
  }

  calculateStats(source: unknown): DocumentStatsDetailed {
    return calculateStats(source, { wordsPerMinute: this.wordsPerMinute });
  }
}
