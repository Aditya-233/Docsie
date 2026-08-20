import type { TiptapNode } from "./docx-generator";

function serializeMarks(text: string, marks?: Array<{ type: string; attrs?: Record<string, any> }>): string {
  if (!marks || marks.length === 0 || !text) return text;

  let result = text;
  for (const mark of marks) {
    switch (mark.type) {
      case "bold":
        result = `**${result}**`;
        break;
      case "italic":
        result = `*${result}*`;
        break;
      case "strike":
        result = `~~${result}~~`;
        break;
      case "code":
        result = `\`${result}\``;
        break;
      case "link": {
        const href = mark.attrs?.href || "#";
        result = `[${result}](${href})`;
        break;
      }
    }
  }

  return result;
}

function serializeInline(nodes?: TiptapNode[]): string {
  if (!nodes || nodes.length === 0) return "";
  return nodes
    .map((node) => {
      if (node.type === "text" && node.text) {
        return serializeMarks(node.text, node.marks);
      }
      if (node.type === "hardBreak") {
        return "\n";
      }
      if (node.type === "image") {
        const alt = node.attrs?.alt || "";
        const src = node.attrs?.src || "";
        return `![${alt}](${src})`;
      }
      return "";
    })
    .join("");
}

export function exportMarkdown(tiptapJson: any): string {
  if (!tiptapJson || !tiptapJson.content) return "";

  const lines: string[] = [];

  function processNode(node: TiptapNode, depth = 0): void {
    switch (node.type) {
      case "heading": {
        const level = Math.min(Math.max(node.attrs?.level || 1, 1), 6);
        const prefix = "#".repeat(level);
        const text = serializeInline(node.content);
        lines.push(`\n${prefix} ${text}\n`);
        break;
      }

      case "paragraph": {
        const text = serializeInline(node.content);
        lines.push(`\n${text}\n`);
        break;
      }

      case "bulletList": {
        if (node.content) {
          const indent = "  ".repeat(depth);
          for (const item of node.content) {
            if (item.content) {
              for (const p of item.content) {
                if (p.type === "paragraph") {
                  lines.push(`${indent}- ${serializeInline(p.content)}`);
                } else if (p.type === "bulletList" || p.type === "orderedList") {
                  processNode(p, depth + 1);
                }
              }
            }
          }
          lines.push("");
        }
        break;
      }

      case "orderedList": {
        if (node.content) {
          const indent = "  ".repeat(depth);
          let idx = node.attrs?.start || 1;
          for (const item of node.content) {
            if (item.content) {
              for (const p of item.content) {
                if (p.type === "paragraph") {
                  lines.push(`${indent}${idx}. ${serializeInline(p.content)}`);
                  idx++;
                } else if (p.type === "bulletList" || p.type === "orderedList") {
                  processNode(p, depth + 1);
                }
              }
            }
          }
          lines.push("");
        }
        break;
      }

      case "taskList": {
        if (node.content) {
          for (const item of node.content) {
            const checked = item.attrs?.checked ? "[x]" : "[ ]";
            const text = item.content?.map((c) => serializeInline(c.content)).join(" ") || "";
            lines.push(`- ${checked} ${text}`);
          }
          lines.push("");
        }
        break;
      }

      case "blockquote": {
        const text = node.content?.map((c) => serializeInline(c.content)).join("\n> ") || "";
        lines.push(`\n> ${text}\n`);
        break;
      }

      case "codeBlock": {
        const language = node.attrs?.language || "";
        const code = node.content?.map((c) => c.text || "").join("") || "";
        lines.push(`\n\`\`\`${language}\n${code}\n\`\`\`\n`);
        break;
      }

      case "horizontalRule": {
        lines.push("\n---\n");
        break;
      }

      case "table": {
        if (!node.content || node.content.length === 0) break;
        const rows = node.content;
        const matrix: string[][] = [];

        for (const row of rows) {
          const rowData: string[] = [];
          if (row.content) {
            for (const cell of row.content) {
              const cellText = cell.content
                ? cell.content.map((c) => serializeInline(c.content)).join(" ")
                : "";
              rowData.push(cellText.replace(/\|/g, "\\|").trim());
            }
          }
          matrix.push(rowData);
        }

        if (matrix.length > 0) {
          const colCount = Math.max(...matrix.map((r) => r.length));
          const headerRow = matrix[0] || [];
          while (headerRow.length < colCount) headerRow.push("");

          lines.push(`\n| ${headerRow.join(" | ")} |`);
          lines.push(`| ${Array(colCount).fill("---").join(" | ")} |`);

          for (let r = 1; r < matrix.length; r++) {
            const row = matrix[r];
            while (row.length < colCount) row.push("");
            lines.push(`| ${row.join(" | ")} |`);
          }
          lines.push("");
        }
        break;
      }

      default: {
        if (node.content) {
          for (const child of node.content) {
            processNode(child, depth);
          }
        }
        break;
      }
    }
  }

  for (const node of tiptapJson.content) {
    processNode(node);
  }

  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

import { downloadBlob } from "../utils";

export function downloadMarkdown(tiptapJson: any, filename = "document.md"): void {
  const md = exportMarkdown(tiptapJson);
  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  downloadBlob(blob, filename.endsWith(".md") ? filename : `${filename}.md`);
}
