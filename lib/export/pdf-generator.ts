/**
 * PDF generator for Google Docs clone
 * Generates formatted printable document using standard @page { size: letter; margin: 1in; } styling
 * and triggers window.print() or headless export.
 */

export interface PdfExportOptions {
  title?: string;
  pageSize?: "letter" | "a4" | "legal";
  margin?: string;
  fontFamily?: string;
}

export function generatePrintableHtml(
  htmlContent: string,
  options: PdfExportOptions = {}
): string {
  const {
    title = "Document",
    pageSize = "letter",
    margin = "1in",
    fontFamily = "Arial, Helvetica, sans-serif",
  } = options;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    @page {
      size: ${pageSize};
      margin: ${margin};
    }

    @media print {
      body {
        margin: 0;
        padding: 0;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .page-break {
        page-break-before: always;
      }
    }

    *, *::before, *::after {
      box-sizing: border-box;
    }

    body {
      font-family: ${fontFamily};
      font-size: 11pt;
      line-height: 1.5;
      color: #111827;
      background-color: #ffffff;
      margin: 0 auto;
      padding: 24px;
      max-width: 8.5in;
    }

    h1, h2, h3, h4, h5, h6 {
      color: #111827;
      font-weight: 700;
      line-height: 1.25;
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      page-break-after: avoid;
    }

    h1 { font-size: 20pt; }
    h2 { font-size: 16pt; }
    h3 { font-size: 13pt; }
    h4 { font-size: 11pt; }

    p {
      margin-top: 0;
      margin-bottom: 0.75em;
    }

    blockquote {
      border-left: 3px solid #cbd5e1;
      padding-left: 14px;
      margin: 1em 0;
      color: #475569;
      font-style: italic;
    }

    pre, code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 9.5pt;
      background-color: #f1f5f9;
      border-radius: 4px;
    }

    pre {
      padding: 12px;
      overflow-x: auto;
      border: 1px solid #e2e8f0;
      margin: 1em 0;
      white-space: pre-wrap;
      word-break: break-word;
    }

    code {
      padding: 2px 4px;
    }

    ul, ol {
      margin-top: 0;
      margin-bottom: 0.75em;
      padding-left: 24px;
    }

    li {
      margin-bottom: 0.25em;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1em 0;
      page-break-inside: avoid;
    }

    th, td {
      border: 1px solid #cbd5e1;
      padding: 8px 12px;
      text-align: left;
      font-size: 10pt;
    }

    th {
      background-color: #f8fafc;
      font-weight: 600;
    }

    img {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 1em 0;
    }

    hr {
      border: 0;
      border-top: 1px solid #e2e8f0;
      margin: 1.5em 0;
    }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function exportPdf(htmlContent: string, title = "Document"): void {
  if (typeof window === "undefined") return;

  const printableHtml = generatePrintableHtml(htmlContent, { title });

  // Create an isolated hidden iframe to run window.print()
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.setAttribute("aria-hidden", "true");

  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }

  doc.open();
  doc.write(printableHtml);
  doc.close();

  // Wait for styles and images to load before printing
  iframe.onload = () => {
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.error("Print error:", err);
      } finally {
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 1000);
      }
    }, 250);
  };
}
