import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  exportMarkdown,
  generateHtmlDocument,
  extractPlainText,
  generateDocxBuffer,
} from "../lib/export/index";

describe("Document Exporters (Markdown, HTML, Plain Text, DOCX)", () => {
  describe("Markdown Exporter Formatting", () => {
    it("should export heading hierarchy levels H1 through H6 to markdown", () => {
      const tiptapJson = {
        type: "doc",
        content: [
          { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Title 1" }] },
          { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Subtitle 2" }] },
          { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "Section 3" }] },
          { type: "heading", attrs: { level: 4 }, content: [{ type: "text", text: "Subsection 4" }] },
          { type: "heading", attrs: { level: 5 }, content: [{ type: "text", text: "Detail 5" }] },
          { type: "heading", attrs: { level: 6 }, content: [{ type: "text", text: "Deep 6" }] },
        ],
      };

      const md = exportMarkdown(tiptapJson);
      assert.ok(md.includes("# Title 1"));
      assert.ok(md.includes("## Subtitle 2"));
      assert.ok(md.includes("### Section 3"));
      assert.ok(md.includes("#### Subsection 4"));
      assert.ok(md.includes("##### Detail 5"));
      assert.ok(md.includes("###### Deep 6"));
    });

    it("should format inline marks: bold, italic, strikethrough, code, and links", () => {
      const tiptapJson = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "This is " },
              { type: "text", text: "bold text", marks: [{ type: "bold" }] },
              { type: "text", text: ", " },
              { type: "text", text: "italic text", marks: [{ type: "italic" }] },
              { type: "text", text: ", " },
              { type: "text", text: "strikethrough", marks: [{ type: "strike" }] },
              { type: "text", text: ", " },
              { type: "text", text: "inline code", marks: [{ type: "code" }] },
              { type: "text", text: ", and a " },
              {
                type: "text",
                text: "web link",
                marks: [{ type: "link", attrs: { href: "https://example.com" } }],
              },
              { type: "text", text: "." },
            ],
          },
        ],
      };

      const md = exportMarkdown(tiptapJson);
      assert.ok(md.includes("**bold text**"));
      assert.ok(md.includes("*italic text*"));
      assert.ok(md.includes("~~strikethrough~~"));
      assert.ok(md.includes("`inline code`"));
      assert.ok(md.includes("[web link](https://example.com)"));
    });

    it("should format bullet lists, ordered lists, and task lists", () => {
      const tiptapJson = {
        type: "doc",
        content: [
          {
            type: "bulletList",
            content: [
              { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Item Alpha" }] }] },
              { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Item Beta" }] }] },
            ],
          },
          {
            type: "orderedList",
            content: [
              { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Step One" }] }] },
              { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Step Two" }] }] },
            ],
          },
          {
            type: "taskList",
            content: [
              {
                type: "taskItem",
                attrs: { checked: true },
                content: [{ type: "paragraph", content: [{ type: "text", text: "Completed task" }] }],
              },
              {
                type: "taskItem",
                attrs: { checked: false },
                content: [{ type: "paragraph", content: [{ type: "text", text: "Pending task" }] }],
              },
            ],
          },
        ],
      };

      const md = exportMarkdown(tiptapJson);
      assert.ok(md.includes("- Item Alpha"));
      assert.ok(md.includes("- Item Beta"));
      assert.ok(md.includes("1. Step One"));
      assert.ok(md.includes("2. Step Two"));
      assert.ok(md.includes("- [x] Completed task"));
      assert.ok(md.includes("- [ ] Pending task"));
    });

    it("should format blockquotes, code blocks, and horizontal rules", () => {
      const tiptapJson = {
        type: "doc",
        content: [
          {
            type: "blockquote",
            content: [
              { type: "paragraph", content: [{ type: "text", text: "Knowledge is power." }] },
            ],
          },
          {
            type: "codeBlock",
            attrs: { language: "typescript" },
            content: [{ type: "text", text: "const answer: number = 42;" }],
          },
          { type: "horizontalRule" },
        ],
      };

      const md = exportMarkdown(tiptapJson);
      assert.ok(md.includes("> Knowledge is power."));
      assert.ok(md.includes("```typescript"));
      assert.ok(md.includes("const answer: number = 42;"));
      assert.ok(md.includes("---"));
    });

    it("should format markdown tables with header separator and cell pipe escaping", () => {
      const tiptapJson = {
        type: "doc",
        content: [
          {
            type: "table",
            content: [
              {
                type: "tableRow",
                content: [
                  { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "Feature" }] }] },
                  { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "Status | Notes" }] }] },
                ],
              },
              {
                type: "tableRow",
                content: [
                  { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "CRDT Sync" }] }] },
                  { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Sub-50ms" }] }] },
                ],
              },
              {
                type: "tableRow",
                content: [
                  { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Awareness" }] }] },
                  { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Multi-cursor" }] }] },
                ],
              },
            ],
          },
        ],
      };

      const md = exportMarkdown(tiptapJson);
      assert.ok(md.includes("| Feature | Status \\| Notes |"));
      assert.ok(md.includes("| --- | --- |"));
      assert.ok(md.includes("| CRDT Sync | Sub-50ms |"));
      assert.ok(md.includes("| Awareness | Multi-cursor |"));
    });
  });

  describe("HTML Document Generation", () => {
    it("should generate a complete standalone HTML5 document with CSS styling", () => {
      const htmlBody = "<h1>Q3 Roadmap</h1><p>Welcome to <strong>Google Docs Clone</strong>.</p>";
      const docHtml = generateHtmlDocument(htmlBody, "Q3 Strategic Plan");

      assert.ok(docHtml.startsWith("<!DOCTYPE html>"));
      assert.ok(docHtml.includes("<html lang=\"en\">"));
      assert.ok(docHtml.includes("<title>Q3 Strategic Plan</title>"));
      assert.ok(docHtml.includes("<style>"));
      assert.ok(docHtml.includes(".document-container"));
      assert.ok(docHtml.includes("<div class=\"document-container\">"));
      assert.ok(docHtml.includes(htmlBody));
      assert.ok(docHtml.endsWith("</html>"));
    });
  });

  describe("Plain Text Exporter", () => {
    it("should extract clean plain text from Tiptap JSON node structures", () => {
      const tiptapJson = {
        type: "doc",
        content: [
          { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Project Report" }] },
          {
            type: "paragraph",
            content: [
              { type: "text", text: "This is the first sentence. " },
              { type: "text", text: "And this is the second." },
            ],
          },
          {
            type: "paragraph",
            content: [{ type: "text", text: "Paragraph two details." }],
          },
        ],
      };

      const text = extractPlainText(tiptapJson);
      assert.ok(text.includes("Project Report"));
      assert.ok(text.includes("This is the first sentence. And this is the second."));
      assert.ok(text.includes("Paragraph two details."));
    });

    it("should return empty string on null or empty input", () => {
      assert.strictEqual(extractPlainText(null), "");
      assert.strictEqual(extractPlainText({}), "");
      assert.strictEqual(extractPlainText({ type: "doc", content: [] }), "");
    });
  });

  describe("DOCX Structure Generation", () => {
    it("should generate a valid DOCX OpenXML binary buffer from Tiptap document AST", async () => {
      const tiptapJson = {
        type: "doc",
        content: [
          { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Executive Summary" }] },
          {
            type: "paragraph",
            attrs: { textAlign: "center" },
            content: [
              { type: "text", text: "Generated via " },
              { type: "text", text: "docx library", marks: [{ type: "bold" }, { type: "italic" }] },
              { type: "text", text: "." },
            ],
          },
          {
            type: "bulletList",
            content: [
              { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "First bullet item" }] }] },
              { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Second bullet item" }] }] },
            ],
          },
          {
            type: "table",
            content: [
              {
                type: "tableRow",
                content: [
                  { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Header 1" }] }] },
                  { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Header 2" }] }] },
                ],
              },
              {
                type: "tableRow",
                content: [
                  { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Value A" }] }] },
                  { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Value B" }] }] },
                ],
              },
            ],
          },
        ],
      };

      const buffer = await generateDocxBuffer(tiptapJson, "Executive Summary");

      assert.ok(buffer instanceof Buffer);
      assert.ok(buffer.length > 1000);

      // Verify DOCX ZIP / PK header magic bytes (0x50, 0x4B, 0x03, 0x04)
      assert.strictEqual(buffer[0], 0x50); // "P"
      assert.strictEqual(buffer[1], 0x4B); // "K"
      assert.strictEqual(buffer[2], 0x03);
      assert.strictEqual(buffer[3], 0x04);
    });

    it("should handle empty document gracefully when generating DOCX", async () => {
      const buffer = await generateDocxBuffer({ type: "doc", content: [] }, "Empty Document");
      assert.ok(buffer instanceof Buffer);
      assert.ok(buffer.length > 500);
      assert.strictEqual(buffer[0], 0x50);
      assert.strictEqual(buffer[1], 0x4B);
    });
  });
});
