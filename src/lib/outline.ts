export interface HeadingItem { id: string; text: string; level: number; index: number; slug: string; }
export interface HeadingTreeNode extends HeadingItem { children: HeadingTreeNode[]; }
export interface DocumentStatsDetailed {
    words: number; characters: number; charactersNoSpaces: number; paragraphs: number; lines: number;
    readingTimeMinutes: number; readingTimeFormatted: string; speakingTimeMinutes: number; speakingTimeFormatted: string; pagesEstimate: number;
}

export function slugifyHeading(text = "", existingSlugs: Set<string> | string[] = new Set()): string {
    const seen = existingSlugs instanceof Set ? existingSlugs : new Set(existingSlugs || []);
    let base = (text || "").toString().toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "") || "section";
    let slug = base, c = 1;
    while (seen.has(slug)) slug = `${base}-${c++}`;
    seen.add(slug);
    return slug;
}

export function stripHtmlTags(html: string): string {
    if (!html) return "";
    return html.replace(/<(style|script)[^>]*>[\s\S]*?<\/\1>/gi, "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
}

export function extractHeadings(source: unknown, options: { maxLevel?: number; defaultTitle?: string } = {}): HeadingItem[] {
    const max = options.maxLevel || 6, def = options.defaultTitle || "Untitled section", headings: HeadingItem[] = [], slugs = new Set<string>();
    if (!source) return headings;
    if (typeof source === "string") {
        const rx = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;
        let m: RegExpExecArray | null, idx = 0;
        while ((m = rx.exec(source)) !== null) {
            const level = parseInt(m[1], 10);
            if (level <= max) { const text = stripHtmlTags(m[2]) || def; headings.push({ id: `h${level}-${idx}`, text, level, index: idx++, slug: slugifyHeading(text, slugs) }); }
        }
    } else if (typeof source === "object" && source !== null && "content" in (source as any)) {
        let idx = 0;
        const walk = (node: any) => {
            if (node.type === "heading" && (node.attrs?.level || 1) <= max) {
                const text = (node.content?.map((c: any) => c.text || "").join("") || "").trim() || def;
                headings.push({ id: `h${node.attrs?.level || 1}-${idx}`, text, level: node.attrs?.level || 1, index: idx++, slug: slugifyHeading(text, slugs) });
            }
            if (Array.isArray(node.content)) node.content.forEach(walk);
        };
        walk(source);
    }
    return headings;
}

export function buildHeadingTree(flat: HeadingItem[]): HeadingTreeNode[] {
    if (!flat || !flat.length) return [];
    const roots: HeadingTreeNode[] = [], stack: HeadingTreeNode[] = [];
    for (const h of flat) {
        const node: HeadingTreeNode = { ...h, children: [] };
        while (stack.length && stack[stack.length - 1].level >= node.level) stack.pop();
        if (!stack.length) roots.push(node);
        else stack[stack.length - 1].children.push(node);
        stack.push(node);
    }
    return roots;
}

export function calculateStats(input: string, options: { wordsPerMinute?: number; speakingWordsPerMinute?: number } = {}): DocumentStatsDetailed {
    const wpm = options.wordsPerMinute || 200, swpm = options.speakingWordsPerMinute || 130;
    if (!input || !input.trim()) return { words: 0, characters: 0, charactersNoSpaces: 0, paragraphs: 0, lines: 0, readingTimeMinutes: 0, readingTimeFormatted: "0 min", speakingTimeMinutes: 0, speakingTimeFormatted: "0 min", pagesEstimate: 0 };
    const isHtml = /<[a-z][\s\S]*>/i.test(input);
    let paragraphs = 0;
    if (isHtml) { const p = input.match(/<(p|h[1-6]|li|blockquote|div)[^>]*>[\s\S]*?<\/\1>/gi); paragraphs = p ? p.filter(b => stripHtmlTags(b).length > 0).length : 0; }
    const plain = isHtml ? stripHtmlTags(input) : input, trimmed = plain.trim(), words = trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;
    const characters = plain.length, charactersNoSpaces = plain.replace(/\s/g, "").length;
    if (!paragraphs) paragraphs = plain ? plain.split(/\n+/).filter(l => l.trim().length > 0).length : 0;
    const lines = plain ? plain.split(/\r\n|\r|\n/).length : 0, rMin = words ? Math.max(1, Math.round(words / wpm)) : 0, sMin = words ? Math.round(words / swpm) : 0;
    return { words, characters, charactersNoSpaces, paragraphs, lines, readingTimeMinutes: rMin, readingTimeFormatted: words ? (words < wpm ? "< 1 min" : `${rMin} min`) : "0 min", speakingTimeMinutes: sMin, speakingTimeFormatted: `${sMin} min`, pagesEstimate: words ? Math.ceil(words / 500) : 0 };
}

export class OutlineExtractor {
    constructor(private opts: any = {}) { }
    extract(source: string) { const headings = extractHeadings(source, this.opts); return { headings, tree: buildHeadingTree(headings), stats: calculateStats(source, this.opts) }; }
}
