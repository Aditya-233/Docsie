/**
 * HTML exporter for Google Docs clone
 */

export function generateHtmlDocument(htmlBody: string, title = "Untitled Document"): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11pt;
      line-height: 1.5;
      color: #202124;
      background-color: #f8f9fa;
      margin: 0;
      padding: 40px 20px;
    }
    .document-container {
      max-width: 816px;
      min-height: 1056px;
      background-color: #ffffff;
      margin: 0 auto;
      padding: 72px;
      box-shadow: 0 1px 3px rgba(60,64,67,0.15), 0 1px 2px rgba(60,64,67,0.3);
      border-radius: 2px;
    }
    h1, h2, h3, h4, h5, h6 {
      color: #202124;
      margin-top: 24px;
      margin-bottom: 8px;
    }
    p { margin-top: 0; margin-bottom: 12px; }
    blockquote {
      border-left: 3px solid #dadce0;
      padding-left: 14px;
      color: #5f6368;
      margin: 16px 0;
      font-style: italic;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
    }
    th, td {
      border: 1px solid #dadce0;
      padding: 8px 12px;
      text-align: left;
    }
    th {
      background-color: #f1f3f4;
    }
    code {
      font-family: Consolas, Monaco, monospace;
      background: #f1f3f4;
      padding: 2px 4px;
      border-radius: 3px;
    }
    pre {
      background: #f1f3f4;
      padding: 12px;
      border-radius: 4px;
      overflow-x: auto;
    }
    img { max-width: 100%; height: auto; }
  </style>
</head>
<body>
  <div class="document-container">
    ${htmlBody}
  </div>
</body>
</html>`;
}

export function downloadHtml(htmlBody: string, filename = "document.html"): void {
  const doc = generateHtmlDocument(htmlBody, filename.replace(/\.html$/i, ""));
  const blob = new Blob([doc], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".html") ? filename : `${filename}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
