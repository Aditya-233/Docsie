/**
 * Multi-Format Document Exporter Suite for Google Docs Clone.
 * 
 * Supports exporting documents to Markdown, Standalone HTML, Plain Text,
 * and Microsoft Word (.docx) formats with headless / Node.js test support.
 */

/**
 * Decode common HTML entities.
 * @param {string} text - HTML string with entities
 * @returns {string} Decoded plain text
 */
export function decodeHtmlEntities(text) {
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

/**
 * Convert HTML table strings into GitHub Flavored Markdown (GFM) tables.
 * @param {string} tableHtml - Raw table HTML
 * @returns {string} Markdown table
 */
export function convertTableToMarkdown(tableHtml) {
  if (!tableHtml) return '';

  const rows = [];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;

  while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
    const rowContent = rowMatch[1];
    const cells = [];
    const cellRegex = /<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi;
    let cellMatch;

    while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
      let cellText = cellMatch[1]
        .replace(/<br\s*[\/]?>/gi, ' ')
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

  // Normalize column counts
  const maxCols = Math.max(...rows.map(r => r.length));
  const normalizedRows = rows.map(r => {
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

/**
 * Convert HTML content to clean GitHub Flavored Markdown (GFM).
 * @param {string} html - Raw HTML from editor
 * @returns {string} Formatted Markdown
 */
export function htmlToMarkdown(html) {
  if (!html) return '';

  let md = html;

  // 1. Preformatted code blocks <pre><code class="...">content</code></pre>
  md = md.replace(/<pre[^>]*><code(?:\s+class="(?:language-)?([a-z0-9_-]+)")?[^>]*>([\s\S]*?)<\/code><\/pre>/gi, (match, lang, code) => {
    const decoded = decodeHtmlEntities(code.replace(/<br\s*[\/]?>/gi, '\n').replace(/<[^>]+>/g, ''));
    return `\n\`\`\`${lang || ''}\n${decoded}\n\`\`\`\n\n`;
  });

  // 2. Standalone <pre> tags
  md = md.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (match, code) => {
    const decoded = decodeHtmlEntities(code.replace(/<br\s*[\/]?>/gi, '\n').replace(/<[^>]+>/g, ''));
    return `\n\`\`\`\n${decoded}\n\`\`\`\n\n`;
  });

  // 3. Tables
  md = md.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (match) => {
    return convertTableToMarkdown(match);
  });

  // 4. Headings
  md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n\n');
  md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n\n');
  md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n\n');
  md = md.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n\n');
  md = md.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '\n##### $1\n\n');
  md = md.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '\n###### $1\n\n');

  // 5. Horizontal rules
  md = md.replace(/<hr\s*[\/]?>/gi, '\n---\n\n');

  // 6. Blockquotes
  md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (match, content) => {
    const lines = content.replace(/<p[^>]*>/gi, '').replace(/<\/p>/gi, '\n').split('\n');
    const quoted = lines.map(line => `> ${line.trim()}`).filter(l => l !== '> ').join('\n');
    return `\n${quoted}\n\n`;
  });

  // 7. Checklists / Task lists
  md = md.replace(/<li[^>]*data-list="checked"[^>]*>([\s\S]*?)<\/li>/gi, '- [x] $1\n');
  md = md.replace(/<li[^>]*data-list="unchecked"[^>]*>([\s\S]*?)<\/li>/gi, '- [ ] $1\n');

  // 8. Ordered & Unordered Lists
  md = md.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (match, items) => {
    return items.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n') + '\n';
  });

  md = md.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (match, items) => {
    let index = 1;
    return items.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (m, itemText) => `${index++}. ${itemText}\n`) + '\n';
  });

  // 9. Links & Images
  md = md.replace(/<img[^>]*src="([^"]+)"(?:[^>]*alt="([^"]*)")?[^>]*>/gi, (m, src, alt) => `![${alt || ''}](${src})`);
  md = md.replace(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');

  // 10. Inline formatting
  md = md.replace(/<(?:strong|b)[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi, '**$1**');
  md = md.replace(/<(?:em|i)[^>]*>([\s\S]*?)<\/(?:em|i)>/gi, '*$1*');
  md = md.replace(/<(?:s|del|strike)[^>]*>([\s\S]*?)<\/(?:s|del|strike)>/gi, '~~$1~~');
  md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');
  md = md.replace(/<u[^>]*>([\s\S]*?)<\/u>/gi, '<u>$1</u>');

  // 11. Paragraphs & Line Breaks
  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n');
  md = md.replace(/<br\s*[\/]?>/gi, '\n');

  // 12. Strip remaining HTML tags
  md = md.replace(/<[^>]+>/g, '');

  // 13. Decode entities & clean excess whitespace
  md = decodeHtmlEntities(md);
  md = md.replace(/\n{3,}/g, '\n\n');

  return md.trim();
}

/**
 * Generate a complete, standalone, production-styled HTML5 document.
 * @param {string} title - Document title
 * @param {string} bodyHtml - Document body HTML
 * @param {object} [options] - Configuration options (pageColor, margins, customCss)
 * @returns {string} Standalone HTML document string
 */
export function generateStandaloneHTML(title = 'Untitled document', bodyHtml = '', options = {}) {
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

/**
 * Convert HTML document content to plain text with proper indentation and spacing.
 * @param {string} html - HTML string
 * @returns {string} Clean plain text
 */
export function htmlToPlainText(html) {
  if (!html) return '';

  let text = html;

  // Replace block elements with newlines
  text = text.replace(/<\/(p|div|h[1-6]|blockquote|pre|tr)>/gi, '\n');
  text = text.replace(/<br\s*[\/]?>/gi, '\n');
  text = text.replace(/<li[^>]*>/gi, '  • ');
  text = text.replace(/<\/li>/gi, '\n');
  text = text.replace(/<(?:td|th)[^>]*>/gi, '\t');

  // Strip remaining tags
  text = text.replace(/<[^>]+>/g, '');

  // Decode entities
  text = decodeHtmlEntities(text);

  // Normalize blank lines
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}

/**
 * Generate Microsoft Word compliant HTML/XML wrapper for DOCX export.
 * Produces Office-compatible markup that Word / html-docx-js natively reads.
 * @param {string} title - Document title
 * @param {string} bodyHtml - Document body HTML
 * @param {object} [options] - Options
 * @returns {string} Word-compatible HTML string
 */
export function generateWordHtml(title = 'Document', bodyHtml = '', options = {}) {
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

/**
 * Helper to trigger browser file download or return Blob/Buffer in Node.js.
 * @param {string|Blob} content - File content or Blob
 * @param {string} filename - Download file name
 * @param {string} mimeType - MIME type
 * @returns {Blob|null} Created Blob
 */
export function downloadFile(content, filename, mimeType = 'text/plain;charset=utf-8') {
  if (typeof Blob === 'undefined') {
    // Node.js environment
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

/**
 * Unified Exporter Class
 */
export class DocumentExporter {
  constructor(doc = {}) {
    this.doc = doc;
  }

  /**
   * Set active document for export.
   * @param {object} doc - Document object
   */
  setDocument(doc) {
    this.doc = doc;
  }

  /**
   * Export to Markdown string.
   * @param {string} [customHtml] - Optional HTML override
   * @returns {string} Markdown text
   */
  toMarkdown(customHtml = null) {
    const html = customHtml !== null ? customHtml : (this.doc?.content || '');
    return htmlToMarkdown(html);
  }

  /**
   * Export to Standalone HTML document.
   * @param {object} [options] - Options
   * @returns {string} Standalone HTML
   */
  toHTML(options = {}) {
    const title = options.title || this.doc?.title || 'Untitled document';
    const html = options.content !== undefined ? options.content : (this.doc?.content || '');
    const pageColor = options.pageColor || this.doc?.pageSetup?.pageColor || '#ffffff';
    const margins = options.margins || this.doc?.pageSetup?.margins || { top: 72, right: 72, bottom: 72, left: 72 };
    return generateStandaloneHTML(title, html, { pageColor, margins, ...options });
  }

  /**
   * Export to Plain Text.
   * @param {string} [customHtml] - Optional HTML override
   * @returns {string} Plain text
   */
  toPlainText(customHtml = null) {
    const html = customHtml !== null ? customHtml : (this.doc?.content || '');
    return htmlToPlainText(html);
  }

  /**
   * Export to Word (.docx / Word HTML) document string or Blob.
   * @param {object} [options] - Options
   * @returns {string|Blob} Word document content or Blob
   */
  toDOCX(options = {}) {
    const title = options.title || this.doc?.title || 'Untitled document';
    const html = options.content !== undefined ? options.content : (this.doc?.content || '');
    const margins = options.margins || this.doc?.pageSetup?.margins;
    const wordHtml = generateWordHtml(title, html, { margins, ...options });

    // Check if htmlDocx CDN library is available in browser window
    if (typeof window !== 'undefined' && window.htmlDocx && typeof window.htmlDocx.asBlob === 'function') {
      try {
        return window.htmlDocx.asBlob(wordHtml);
      } catch (e) {
        console.warn('htmlDocx conversion fallback:', e);
      }
    }

    if (typeof Blob !== 'undefined') {
      return new Blob([wordHtml], { type: 'application/msword;charset=utf-8' });
    }

    return wordHtml;
  }

  /**
   * Trigger download for specified format.
   * @param {'md'|'markdown'|'html'|'txt'|'docx'} format - Format to export
   * @param {string} [customFilename] - Custom output filename
   */
  download(format = 'md', customFilename = null) {
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
