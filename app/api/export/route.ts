import { NextResponse } from "next/server";
import { generateDocxBuffer } from "@/lib/export/docx-generator";
import { exportMarkdown } from "@/lib/export/markdown-generator";
import { generateHtmlDocument } from "@/lib/export/html-generator";
import { extractPlainText } from "@/lib/export/txt-generator";
import { generatePrintableHtml } from "@/lib/export/pdf-generator";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { format = "docx", content, title = "document" } = body;

    const safeTitle = (title || "document")
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .replace(/_+/g, "_");

    if (!content) {
      return NextResponse.json(
        { error: "Document content is required for export." },
        { status: 400 }
      );
    }

    switch (format.toLowerCase()) {
      case "docx": {
        const tiptapJson = typeof content === "string" ? JSON.parse(content) : content;
        const buffer = await generateDocxBuffer(tiptapJson, title);

        return new NextResponse(new Uint8Array(buffer), {
          status: 200,
          headers: {
            "Content-Type":
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "Content-Disposition": `attachment; filename="${safeTitle}.docx"`,
            "Content-Length": buffer.length.toString(),
          },
        });
      }

      case "md":
      case "markdown": {
        const tiptapJson = typeof content === "string" ? JSON.parse(content) : content;
        const markdown = exportMarkdown(tiptapJson);

        return new NextResponse(markdown, {
          status: 200,
          headers: {
            "Content-Type": "text/markdown; charset=utf-8",
            "Content-Disposition": `attachment; filename="${safeTitle}.md"`,
          },
        });
      }

      case "pdf": {
        // PDF printable HTML payload
        let htmlPayload = "";
        if (typeof content === "string" && content.trim().startsWith("<")) {
          htmlPayload = content;
        } else {
          // If tiptap json, generate html
          const tiptapJson = typeof content === "string" ? JSON.parse(content) : content;
          const md = exportMarkdown(tiptapJson);
          htmlPayload = `<div>${md.replace(/\n/g, "<br/>")}</div>`;
        }

        const printable = generatePrintableHtml(htmlPayload, { title });
        return new NextResponse(printable, {
          status: 200,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Content-Disposition": `inline; filename="${safeTitle}.html"`,
          },
        });
      }

      case "html": {
        const htmlBody = typeof content === "string" ? content : JSON.stringify(content);
        const fullHtml = generateHtmlDocument(htmlBody, title);

        return new NextResponse(fullHtml, {
          status: 200,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Content-Disposition": `attachment; filename="${safeTitle}.html"`,
          },
        });
      }

      case "txt":
      case "text": {
        let textResult = "";
        if (typeof content === "object") {
          textResult = extractPlainText(content);
        } else {
          textResult = content.toString();
        }

        return new NextResponse(textResult, {
          status: 200,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Content-Disposition": `attachment; filename="${safeTitle}.txt"`,
          },
        });
      }

      default:
        return NextResponse.json(
          { error: `Unsupported export format: ${format}` },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error("Export API error:", error);
    return NextResponse.json(
      { error: error?.message || "An error occurred during export processing." },
      { status: 500 }
    );
  }
}
