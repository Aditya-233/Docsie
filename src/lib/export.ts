import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType, UnderlineType } from "docx";
import { downloadBlob } from "./utils";


export async function generateDocxBlob(tiptapJson: any, title = "Untitled"): Promise<Blob> {
    const buf = await generateDocxBuffer(tiptapJson, title);
    return new Blob([new Uint8Array(buf)], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
}

export async function generateDocxBuffer(json: any, title = "Untitled"): Promise<Buffer> {
    const runs = (nodes?: any[]) => (nodes || []).map((n) => {
        if (n.type === "hardBreak") return new TextRun({ break: 1 });
        const m = n.marks || [];
        return new TextRun({ text: n.text || "", bold: m.some((x: any) => x.type === "bold"), italics: m.some((x: any) => x.type === "italic"), strike: m.some((x: any) => x.type === "strike"), underline: m.some((x: any) => x.type === "underline") ? { type: UnderlineType.SINGLE } : undefined });
    });

    const children: any[] = [];
    (json?.content || []).forEach((node: any) => {
        if (node.type === "heading") {
            const lv = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4][Math.min(3, (node.attrs?.level || 1) - 1)];
            children.push(new Paragraph({ heading: lv, children: runs(node.content), spacing: { after: 120 } }));
        } else if (node.type === "paragraph") {
            const align = node.attrs?.textAlign === "center" ? AlignmentType.CENTER : node.attrs?.textAlign === "right" ? AlignmentType.RIGHT : AlignmentType.LEFT;
            children.push(new Paragraph({ alignment: align, children: runs(node.content), spacing: { after: 100 } }));
        } else if (node.type === "table") {
            const rows = (node.content || []).map((r: any) => new TableRow({ children: (r.content || []).map((c: any) => new TableCell({ children: [new Paragraph({ children: runs(c.content?.[0]?.content) })], width: { size: 100 / (r.content?.length || 1), type: WidthType.PERCENTAGE } })) }));
            children.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }));
        }
    });
    if (!children.length) children.push(new Paragraph({ children: [new TextRun("")] }));
    return await Packer.toBuffer(new Document({ title, sections: [{ properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } }, children }] }));
}

export function generateMarkdown(json: any): string {
    if (!json?.content) return "";
    const render = (n: any): string => {
        if (!n) return "";
        const cnt = (nodes?: any[]) => (nodes || []).map((x) => {
            let t = x.text || "";
            (x.marks || []).forEach((m: any) => { if (m.type === "bold") t = `**${t}**`; else if (m.type === "italic") t = `*${t}*`; else if (m.type === "strike") t = `~~${t}~~`; else if (m.type === "code") t = `\`${t}\``; else if (m.type === "link") t = `[${t}](${m.attrs?.href || ""})`; });
            return t;
        }).join("");
        if (n.type === "heading") return `${"#".repeat(n.attrs?.level || 1)} ${cnt(n.content)}`;
        if (n.type === "bulletList") return (n.content || []).map((li: any) => `- ${cnt(li.content?.[0]?.content)}`).join("\n");
        if (n.type === "orderedList") return (n.content || []).map((li: any, i: number) => `${i + 1}. ${cnt(li.content?.[0]?.content)}`).join("\n");
        if (n.type === "taskList") return (n.content || []).map((li: any) => `- [${li.attrs?.checked ? "x" : " "}] ${cnt(li.content?.[0]?.content)}`).join("\n");
        if (n.type === "codeBlock") return `\`\`\`${n.attrs?.language || ""}\n${cnt(n.content)}\n\`\`\``;
        if (n.type === "blockquote") return (n.content || []).map((p: any) => `> ${render(p)}`).join("\n");
        if (n.type === "table") {
            const rows = (n.content || []).map((r: any) => `| ${(r.content || []).map((c: any) => render(c.content?.[0] || "")).join(" | ")} |`);
            if (rows.length) rows.splice(1, 0, `| ${new Array(n.content[0]?.content?.length || 1).fill("---").join(" | ")} |`);
            return rows.join("\n");
        }
        return cnt(n.content);
    };
    return json.content.map(render).filter(Boolean).join("\n\n");
}

export function generateHtmlDocument(body: string, title = "Untitled") { return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${title}</title><style>body{font-family:Arial,sans-serif;margin:0;padding:40px;background:#f8f9fa}.document-container{max-width:816px;margin:0 auto;background:#fff;padding:96px;box-shadow:0 1px 3px rgba(0,0,0,.12)}</style></head><body><div class="document-container">${body}</div></body></html>`; }
export function generatePlainText(json: any): string {
    if (!json?.content) return "";
    const walk = (n: any): string => n.text || (n.content ? n.content.map(walk).join("") : "");
    return json.content.map(walk).filter(Boolean).join("\n\n");
}

export function downloadMarkdown(j: any, f = "doc.md") { downloadBlob(new Blob([generateMarkdown(j)], { type: "text/markdown" }), f); }
export function downloadHtml(h: string, f = "doc.html", t?: string) { downloadBlob(new Blob([generateHtmlDocument(h, t || f)], { type: "text/html" }), f); }
export async function downloadDocx(j: any, f = "doc.docx") { downloadBlob(await generateDocxBlob(j, f), f); }
export function downloadPlainText(j: any, f = "doc.txt") { downloadBlob(new Blob([generatePlainText(j)], { type: "text/plain" }), f); }
export function downloadPdf(_el?: any, _f = "doc.pdf") { if (typeof window !== "undefined") window.print(); }

export const exportMarkdown = generateMarkdown;
export const exportDocx = generateDocxBuffer;
export const exportPlainText = generatePlainText;
export const extractPlainText = generatePlainText;
export const downloadTxt = downloadPlainText;
