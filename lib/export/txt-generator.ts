/**
 * Plain text exporter for Google Docs clone
 */

export function extractPlainText(tiptapJson: any): string {
  if (!tiptapJson || !tiptapJson.content) return "";

  const lines: string[] = [];

  function processNode(node: any): void {
    if (node.type === "text" && node.text) {
      lines.push(node.text);
    } else if (node.type === "paragraph" || node.type === "heading") {
      const text = node.content?.map((c: any) => c.text || "").join("") || "";
      if (text) lines.push(text + "\n");
    } else if (node.type === "hardBreak") {
      lines.push("\n");
    } else if (node.content) {
      for (const child of node.content) {
        processNode(child);
      }
    }
  }

  for (const node of tiptapJson.content) {
    processNode(node);
  }

  return lines.join("").trim();
}

import { downloadBlob } from "../utils";

export function downloadTxt(text: string, filename = "document.txt"): void {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  downloadBlob(blob, filename.endsWith(".txt") ? filename : `${filename}.txt`);
}
