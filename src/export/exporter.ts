/**
 * Multi-Format Document Exporter Suite for Google Docs Clone.
 * 
 * Supports exporting documents to Markdown, Standalone HTML, Plain Text,
 * and Microsoft Word (.docx) formats with headless / Node.js test support.
 */

export function decodeHtmlEntities(text: string): string {
  if (!text) return '';
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&hellip;/g, '…');
}

export function convertTableToMarkdown(tableHtml: string): string {
  if (!tableHtml) return '';

  const rows: string[][] = [];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;

  while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
    const rowContent = rowMatch[1];
    const cells: string[] = [];
    const cellRegex = /<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi;
    let cellMatch;

    while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
      const cellText = cellMatch[1]
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<[^>]+>/g, '')
        .replace(/\|/g, '\\|')
        .replace(/\n+/g, ' ')
        .trim();
      cells.push(decodeHtmlEntities(cellText) || ' ');
    }

    if (cells.length > 0) {
      rows.push(cells);
    }
  }

  if (rows.length === 0) return '';

  const maxCols = Math.max(...rows.map((r) => r.length));
  const normalizedRows = rows.map((r) => {
    while (r.length < maxCols) r.push(' ');
    return r;
  });

  const headerRow = normalizedRows[0];
  const separatorRow = headerRow.map(() => '---');
  const dataRows = normalizedRows.slice(1);

  let md = `| ${headerRow.join(' | ')} |\n| ${separatorRow.join(' | ')} |\n`;

  for (const row of dataRows) {
    md += `| ${row.join(' | ')} |\n`;
  }

  return `\n${md}\n`;
}

export function htmlToMarkdown(html: string): string {
  if (!html) return '';

  let md = html;

  md = md.replace(/<pre[^>]*><code(?:\s+class="(?:language-)?([a-z0-9_-]+)")?[^>]*>([\s\S]*?)<\/code><\/pre>/gi, (_match, lang, code) => {
    const decoded = decodeHtmlEntities(code.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''));
    return `\n\`\`\`${lang || ''}\n${decoded}\n\`\`\`\n\n`;
  });

  md = md.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_match, code) => {
    const decoded = decodeHtmlEntities(code.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''));
    return `\n\`\`\`\n${decoded}\n\`\`\`\n\n`;
  });

  md = md.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (match) => {
    return convertTableToMarkdown(match);
  });

  md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n\n');
  md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n\n');
  md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n\n');
  md = md.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n\n');
  md = md.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '\n##### $1\n\n');
  md = md.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '\n###### $1\n\n');

  md = md.replace(/<hr\s*\/?>/gi, '\n---\n\n');

  md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_match, content) => {
    const lines = content.replace(/<p[^>]*>/gi, '').replace(/<\/p>/gi, '\n').split('\n');
    const quoted = lines.map((line: string) => `> ${line.trim()}`).filter((l: string) => l !== '> ').join('\n');
    return `\n${quoted}\n\n`;
  });

  md = md.replace(/<li[^>]*data-list="checked"[^>]*>([\s\S]*?)<\/li>/gi, '- [x] $1\n');
  md = md.replace(/<li[^>]*data-list="unchecked"[^>]*>([\s\S]*?)<\/li>/gi, '- [ ] $1\n');

  md = md.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_match, items) => {
    return items.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n') + '\n';
  });

  md = md.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_match, items) => {
    let index = 1;
    return items.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_m: string, itemText: string) => `${index++}. ${itemText}\n`) + '\n';
  });

  md = md.replace(/<img[^>]*src="([^"]+)"(?:[^>]*alt="([^"]*)")?[^>]*>/gi, (_m, src, alt) => `![${alt || ''}](${src})`);
  md = md.replace(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');

  md = md.replace(/<(?:strong|b)[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi, '**$1**');
  md = md.replace(/<(?:em|i)[^>]*>([\s\S]*?)<\/(?:em|i)>/gi, '*$1*');
  md = md.replace(/<(?:s|del|strike)[^>]*>([\s\S]*?)<\/(?:s|del|strike)>/gi, '~~$1~~');
  md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');
  md = md.replace(/<u[^>]*>([\s\S]*?)<\/u>/gi, '<u>$1</u>');

  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n');
  md = md.replace(/<br\s*\/?>/gi, '\n');

  md = md.replace(/<[^>]+>/g, '');

  md = decodeHtmlEntities(md);
  md = md.replace(/\n{3,}/g, '\n\n');

  return md.trim();
}

export function generateStandaloneHTML(title: string = 'Untitled document', bodyHtml: string = '', options: any = {}): string {
  const pageColor = options.pageColor || '#ffffff';
  const margins = options.margins || { top: 72, right: 72, bottom: 72, left: 72 };
  const customCss = options.customCss || '';
  const lang = options.lang || 'en';

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${decodeHtmlEntities(title)}</title>
  <style>
    :root {
      --font-family: 'Roboto', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      --font-code: 'Fira Code', 'Roboto Mono', monospace;
      --text-color: #1f1f1f;
      --bg-color: ${pageColor};
      --border-color: #dadce0;
      --link-color: #1a73e8;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: var(--font-family);
      font-size: 11pt;
      line-height: 1.5;
      color: var(--text-color);
      background-color: #f8f9fa;
      padding: 24px 0;
    }

    .doc-page-container {
      max-width: 816px;
      min-height: 1056px;
      margin: 0 auto;
      background-color: var(--bg-color);
      padding: ${margins.top}px ${margins.right}px ${margins.bottom}px ${margins.left}px;
      box-shadow: 0 1px 3px 1px rgba(60, 64, 67, 0.15), 0 1px 2px 0 rgba(60, 64, 67, 0.30);
      border-radius: 4px;
      word-wrap: break-word;
    }

    h1, h2, h3, h4, h5, h6 {
      color: #000000;
      font-weight: 500;
      margin-top: 16px;
      margin-bottom: 8px;
      line-height: 1.25;
    }

    h1 { font-size: 20pt; }
    h2 { font-size: 16pt; }
    h3 { font-size: 14pt; }
    h4 { font-size: 12pt; }
    h5 { font-size: 11pt; }
    h6 { font-size: 10pt; }

    p {
      margin-bottom: 8px;
    }

    a {
      color: var(--link-color);
      text-decoration: underline;
    }

    blockquote {
      border-left: 4px solid var(--border-color);
      padding-left: 14px;
      margin: 12px 0;
      color: #5f6368;
      font-style: italic;
    }

    code {
      font-family: var(--font-code);
      font-size: 0.9em;
      background-color: #f1f3f4;
      padding: 2px 5px;
      border-radius: 3px;
    }

    pre {
      font-family: var(--font-code);
      background-color: #f8f9fa;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 12px 16px;
      margin: 12px 0;
      overflow-x: auto;
    }

    pre code {
      background-color: transparent;
      padding: 0;
    }

    ul, ol {
      padding-left: 28px;
      margin-bottom: 8px;
    }

    li {
      margin-bottom: 4px;
    }

    table {
      border-collapse: collapse;
      width: 100%;
      margin: 16px 0;
    }

    th, td {
      border: 1px solid var(--border-color);
      padding: 8px 12px;
      text-align: left;
    }

    th {
      background-color: #f8f9fa;
      font-weight: 600;
    }

    img {
      max-width: 100%;
      height: auto;
      border-radius: 4px;
    }

    hr {
      border: 0;
      border-top: 1px solid var(--border-color);
      margin: 16px 0;
    }

    @media print {
      body {
        background-color: #ffffff;
        padding: 0;
      }
      .doc-page-container {
        box-shadow: none;
        border-radius: 0;
        margin: 0;
        max-width: 100%;
        min-height: 100%;
        padding: 0;
      }
      @page {
        margin: 0.75in;
        size: letter portrait;
      }
    }

    ${customCss}
  </style>
</head>
<body>
  <div class="doc-page-container">
    ${bodyHtml}
  </div>
</body>
</html>`;
}

export function htmlToPlainText(html: string): string {
  if (!html) return '';

  let text = html;

  text = text.replace(/<\/(p|div|h[1-6]|blockquote|pre|tr)>/gi, '\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<li[^>]*>/gi, '  • ');
  text = text.replace(/<\/li>/gi, '\n');
  text = text.replace(/<(?:td|th)[^>]*>/gi, '\t');

  text = text.replace(/<[^>]+>/g, '');
  text = decodeHtmlEntities(text);
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}

export function generateWordHtml(title: string = 'Document', bodyHtml: string = '', options: any = {}): string {
  const margins = options.margins || { top: 72, right: 72, bottom: 72, left: 72 };

  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <title>${decodeHtmlEntities(title)}</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    @page Section1 {
      size: 8.5in 11.0in;
      margin: ${(margins.top / 96).toFixed(2)}in ${(margins.right / 96).toFixed(2)}in ${(margins.bottom / 96).toFixed(2)}in ${(margins.left / 96).toFixed(2)}in;
      mso-header-margin: 0.5in;
      mso-footer-margin: 0.5in;
      mso-paper-source: 0;
    }
    div.Section1 { page: Section1; }
    body {
      font-family: 'Calibri', 'Arial', sans-serif;
      font-size: 11pt;
      line-height: 1.15;
    }
    h1 { font-size: 20pt; font-weight: bold; color: #1f4e78; }
    h2 { font-size: 16pt; font-weight: bold; color: #2e75b6; }
    h3 { font-size: 13pt; font-weight: bold; color: #5b9bd5; }
    table { border-collapse: collapse; width: 100%; }
    td, th { border: 1pt solid #bfbfbf; padding: 5pt; }
    th { background-color: #f2f2f2; font-weight: bold; }
  </style>
</head>
<body>
  <div class="Section1">
    ${bodyHtml}
  </div>
</body>
</html>`;
}

export function downloadFile(content: string | Blob, filename: string, mimeType: string = 'text/plain;charset=utf-8'): Blob | null {
  if (typeof Blob === 'undefined') {
    return null;
  }

  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });

  if (typeof window !== 'undefined' && typeof document !== 'undefined' && document.createElement) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 200);
  }

  return blob;
}

export class DocumentExporter {
  public doc: any;

  constructor(doc: any = {}) {
    this.doc = doc;
  }

  setDocument(doc: any): void {
    this.doc = doc;
  }

  toMarkdown(customHtml: string | null = null): string {
    const html = customHtml !== null ? customHtml : (this.doc?.content || '');
    return htmlToMarkdown(html);
  }

  toHTML(options: any = {}): string {
    const title = options.title || this.doc?.title || 'Untitled document';
    const html = options.content !== undefined ? options.content : (this.doc?.content || '');
    const pageColor = options.pageColor || this.doc?.pageSetup?.pageColor || '#ffffff';
    const margins = options.margins || this.doc?.pageSetup?.margins || { top: 72, right: 72, bottom: 72, left: 72 };
    return generateStandaloneHTML(title, html, { pageColor, margins, ...options });
  }

  toPlainText(customHtml: string | null = null): string {
    const html = customHtml !== null ? customHtml : (this.doc?.content || '');
    return htmlToPlainText(html);
  }

  toDOCX(options: any = {}): string | Blob {
    const title = options.title || this.doc?.title || 'Untitled document';
    const html = options.content !== undefined ? options.content : (this.doc?.content || '');
    const margins = options.margins || this.doc?.pageSetup?.margins;
    const wordHtml = generateWordHtml(title, html, { margins, ...options });

    if (typeof window !== 'undefined' && (window as any).htmlDocx && typeof (window as any).htmlDocx.asBlob === 'function') {
      try {
        return (window as any).htmlDocx.asBlob(wordHtml);
      } catch (e) {
        console.warn('htmlDocx conversion fallback:', e);
      }
    }

    if (typeof Blob !== 'undefined') {
      return new Blob([wordHtml], { type: 'application/msword;charset=utf-8' });
    }

    return wordHtml;
  }

  download(format: string = 'md', customFilename: string | null = null) {
    const title = this.doc?.title || 'document';
    const cleanTitle = title.replace(/[^\w\s-]/g, '').trim() || 'document';
    const ext = format.toLowerCase();

    switch (ext) {
      case 'md':
      case 'markdown': {
        const content = this.toMarkdown();
        const filename = customFilename || `${cleanTitle}.md`;
        return downloadFile(content, filename, 'text/markdown;charset=utf-8');
      }
      case 'html': {
        const content = this.toHTML();
        const filename = customFilename || `${cleanTitle}.html`;
        return downloadFile(content, filename, 'text/html;charset=utf-8');
      }
      case 'txt':
      case 'text': {
        const content = this.toPlainText();
        const filename = customFilename || `${cleanTitle}.txt`;
        return downloadFile(content, filename, 'text/plain;charset=utf-8');
      }
      case 'docx':
      case 'doc': {
        const blobOrStr = this.toDOCX();
        const filename = customFilename || `${cleanTitle}.docx`;
        return downloadFile(blobOrStr, filename, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      }
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }
}
