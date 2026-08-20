import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  slugifyHeading,
  extractHeadings,
  buildHeadingTree,
  calculateStats,
  OutlineExtractor,
} from "../lib/outline";

describe("Document Outline & Live Statistics", () => {
  describe("Heading Slug Generation & Collision Disambiguation", () => {
    it("should generate clean url-safe slugs from heading strings", () => {
      assert.strictEqual(slugifyHeading("Project Proposal 2026!"), "project-proposal-2026");
      assert.strictEqual(slugifyHeading("  Getting Started & Setup  "), "getting-started-setup");
      assert.strictEqual(slugifyHeading(""), "section");
      assert.strictEqual(slugifyHeading("??? --- !!!"), "section");
    });

    it("should resolve duplicate heading collisions by appending incrementing numeric counters", () => {
      const seen = new Set<string>();
      const s1 = slugifyHeading("Overview", seen);
      const s2 = slugifyHeading("Overview", seen);
      const s3 = slugifyHeading("Overview", seen);

      assert.strictEqual(s1, "overview");
      assert.strictEqual(s2, "overview-1");
      assert.strictEqual(s3, "overview-2");
    });
  });

  describe("Heading Extraction from HTML and Tiptap JSON", () => {
    it("should extract flat headings list from HTML source string", () => {
      const html = `
        <h1>Document Title</h1>
        <p>Introduction paragraph.</p>
        <h2>Architecture Overview</h2>
        <p>Details on CRDT.</p>
        <h3>Yjs Provider Handshake</h3>
        <h2>Performance Benchmarks</h2>
      `;

      const headings = extractHeadings(html, { maxLevel: 3 });

      assert.strictEqual(headings.length, 4);
      assert.deepStrictEqual(
        headings.map((h) => ({ text: h.text, level: h.level })),
        [
          { text: "Document Title", level: 1 },
          { text: "Architecture Overview", level: 2 },
          { text: "Yjs Provider Handshake", level: 3 },
          { text: "Performance Benchmarks", level: 2 },
        ]
      );

      assert.strictEqual(headings[0].slug, "document-title");
      assert.strictEqual(headings[1].slug, "architecture-overview");
    });

    it("should extract headings from Tiptap JSON document node structure", () => {
      const tiptapJson = {
        type: "doc",
        content: [
          { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Product Vision" }] },
          { type: "paragraph", content: [{ type: "text", text: "Vision body." }] },
          { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Core Pillars" }] },
          { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "1. Real-time Collaboration" }] },
          { type: "heading", attrs: { level: 4 }, content: [{ type: "text", text: "Deep technical note" }] },
        ],
      };

      // Extract up to level 3
      const headings = extractHeadings(tiptapJson, { maxLevel: 3 });

      assert.strictEqual(headings.length, 3);
      assert.strictEqual(headings[0].text, "Product Vision");
      assert.strictEqual(headings[0].level, 1);
      assert.strictEqual(headings[1].text, "Core Pillars");
      assert.strictEqual(headings[1].level, 2);
      assert.strictEqual(headings[2].text, "1. Real-time Collaboration");
      assert.strictEqual(headings[2].level, 3);
    });

    it("should filter headings above maxLevel and assign fallback default title when empty", () => {
      const html = "<h1></h1><h2>Valid H2</h2><h4>Ignored H4</h4>";
      const headings = extractHeadings(html, { maxLevel: 3, defaultTitle: "Untitled section" });

      assert.strictEqual(headings.length, 2);
      assert.strictEqual(headings[0].text, "Untitled section");
      assert.strictEqual(headings[0].level, 1);
      assert.strictEqual(headings[1].text, "Valid H2");
    });
  });

  describe("Hierarchical Heading Tree Construction", () => {
    it("should construct nested tree hierarchy from flat heading list", () => {
      const flatHeadings = [
        { id: "h1-1", text: "Chapter 1", level: 1, index: 0, slug: "chapter-1" },
        { id: "h2-1", text: "Section 1.1", level: 2, index: 1, slug: "section-1-1" },
        { id: "h3-1", text: "Topic 1.1.1", level: 3, index: 2, slug: "topic-1-1-1" },
        { id: "h2-2", text: "Section 1.2", level: 2, index: 3, slug: "section-1-2" },
        { id: "h1-2", text: "Chapter 2", level: 1, index: 4, slug: "chapter-2" },
      ];

      const tree = buildHeadingTree(flatHeadings);

      assert.strictEqual(tree.length, 2); // Two root chapters

      // Chapter 1 has 2 sections
      assert.strictEqual(tree[0].text, "Chapter 1");
      assert.strictEqual(tree[0].children.length, 2);
      assert.strictEqual(tree[0].children[0].text, "Section 1.1");
      assert.strictEqual(tree[0].children[1].text, "Section 1.2");

      // Section 1.1 has 1 topic
      assert.strictEqual(tree[0].children[0].children.length, 1);
      assert.strictEqual(tree[0].children[0].children[0].text, "Topic 1.1.1");

      // Chapter 2 has 0 child sections
      assert.strictEqual(tree[1].text, "Chapter 2");
      assert.strictEqual(tree[1].children.length, 0);
    });

    it("should handle heading level jumps gracefully (e.g. H1 followed immediately by H3)", () => {
      const flatHeadings = [
        { id: "h1", text: "Root Title", level: 1, index: 0, slug: "root" },
        { id: "h3", text: "Nested Subsection", level: 3, index: 1, slug: "nested" },
      ];

      const tree = buildHeadingTree(flatHeadings);
      assert.strictEqual(tree.length, 1);
      assert.strictEqual(tree[0].children.length, 1);
      assert.strictEqual(tree[0].children[0].text, "Nested Subsection");
      assert.strictEqual(tree[0].children[0].level, 3);
    });

    it("should return empty array when flat heading input is empty", () => {
      assert.deepStrictEqual(buildHeadingTree([]), []);
    });
  });

  describe("Live Word, Character, and Document Statistics", () => {
    it("should compute accurate word, character, and line counts", () => {
      const text = "The quick brown fox jumps over the lazy dog.";
      const stats = calculateStats(text);

      assert.strictEqual(stats.words, 9);
      assert.strictEqual(stats.characters, 44);
      assert.strictEqual(stats.charactersNoSpaces, 36);
      assert.strictEqual(stats.paragraphs, 1);
      assert.strictEqual(stats.lines, 1);
      assert.strictEqual(stats.readingTimeMinutes, 1);
      assert.strictEqual(stats.readingTimeFormatted, "< 1 min");
    });

    it("should handle multi-paragraph HTML input and count non-empty blocks", () => {
      const html = `
        <h1>Quarterly Review</h1>
        <p>This is the first paragraph with some details.</p>
        <p>This is the second paragraph with more content.</p>
        <blockquote>Key quotation from leadership.</blockquote>
      `;

      const stats = calculateStats(html);

      assert.ok(stats.words > 15);
      assert.strictEqual(stats.paragraphs, 4);
    });

    it("should calculate reading and speaking time estimates for longer texts", () => {
      // Create a 600-word text
      const words600 = Array(600).fill("document").join(" ");
      const stats = calculateStats(words600, { wordsPerMinute: 200, speakingWordsPerMinute: 130 });

      assert.strictEqual(stats.words, 600);
      assert.strictEqual(stats.readingTimeMinutes, 3); // 600 / 200 = 3 min
      assert.strictEqual(stats.readingTimeFormatted, "3 min");
      assert.strictEqual(stats.speakingTimeMinutes, 5); // ceil(600 / 130) = 5 min
      assert.strictEqual(stats.speakingTimeFormatted, "5 min");
      assert.strictEqual(stats.pagesEstimate, 2); // ceil(600 / 500) = 2 pages
    });

    it("should return zero counts for empty or whitespace-only inputs", () => {
      const stats = calculateStats("   \n\t  ");

      assert.strictEqual(stats.words, 0);
      assert.strictEqual(stats.characters, 7);
      assert.strictEqual(stats.charactersNoSpaces, 0);
      assert.strictEqual(stats.paragraphs, 0);
      assert.strictEqual(stats.readingTimeFormatted, "0 min");
      assert.strictEqual(stats.speakingTimeFormatted, "0 min");
    });
  });

  describe("OutlineExtractor Class Orchestrator", () => {
    it("should extract both flat headings, outline tree, and statistics through OutlineExtractor class", () => {
      const extractor = new OutlineExtractor({ maxLevel: 3, wordsPerMinute: 200 });

      const html = `
        <h1>Google Docs Clone Architecture</h1>
        <p>A production-ready collaborative text editor built with Next.js, Tiptap, and Supabase.</p>
        <h2>CRDT & Yjs Engine</h2>
        <p>Real-time delta state vectors and binary snapshots.</p>
        <h3>Sub-50ms Latency</h3>
        <p>Ultra fast peer propagation.</p>
      `;

      const outline = extractor.extractOutline(html);
      assert.strictEqual(outline.count, 3);
      assert.strictEqual(outline.headings.length, 3);
      assert.strictEqual(outline.tree.length, 1);
      assert.strictEqual(outline.tree[0].children.length, 1);
      assert.strictEqual(outline.tree[0].children[0].children.length, 1);

      const stats = extractor.calculateStats(html);
      assert.ok(stats.words >= 20);
      assert.ok(stats.paragraphs >= 4);
    });
  });
});
