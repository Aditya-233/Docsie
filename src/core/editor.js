/**
 * Core Editor Wrapper for Google Docs Clone.
 * Manages typography whitelists, format attributes, table insertion, format painter, and history.
 */

export const FONT_SIZES_WHITELIST = ['10px', '12px', '14px', '15px', '16px', '18px', '22px', '28px', '36px', '48px', '72px'];
export const FONT_FAMILIES_WHITELIST = ['Roboto', 'Inter', 'Merriweather', 'Playfair Display', 'Lora', 'Montserrat', 'Fira Code', 'Caveat', 'Comic Neue'];

export const HEADING_LEVELS = [
  { label: 'Normal text', value: false, tag: 'p' },
  { label: 'Heading 1', value: 1, tag: 'h1' },
  { label: 'Heading 2', value: 2, tag: 'h2' },
  { label: 'Heading 3', value: 3, tag: 'h3' }
];

export const FORMAT_TOGGLES = ['bold', 'italic', 'underline', 'strike'];

/**
 * Toggles a binary format state (e.g. bold, italic, underline, strike).
 * @param {Record<string, any>} currentFormats - Active formatting map
 * @param {string} formatKey - Format name to toggle
 * @returns {Record<string, any>} New formatting map
 */
export function toggleFormatState(currentFormats = {}, formatKey) {
  const next = { ...currentFormats };
  if (next[formatKey]) {
    delete next[formatKey];
  } else {
    next[formatKey] = true;
  }
  return next;
}

/**
 * Returns HTML tag associated with heading level.
 * @param {number|boolean|string} level
 * @returns {string} 'h1', 'h2', 'h3', or 'p'
 */
export function getHeadingTag(level) {
  if (level === 1 || level === '1') return 'h1';
  if (level === 2 || level === '2') return 'h2';
  if (level === 3 || level === '3') return 'h3';
  return 'p';
}

/**
 * Validates heading level.
 * @param {any} level
 * @returns {boolean}
 */
export function isValidHeadingLevel(level) {
  return level === false || level === 1 || level === 2 || level === 3 || level === '1' || level === '2' || level === '3' || level === 'normal';
}

/**
 * Format painter state machine: copies formatting from a source range and applies it to target.
 */
export class FormatPainter {
  constructor() {
    this.storedFormat = null;
    this.active = false;
  }

  copyFormat(formatMap) {
    if (!formatMap || typeof formatMap !== 'object') {
      this.clear();
      return null;
    }
    this.storedFormat = { ...formatMap };
    this.active = true;
    return { ...this.storedFormat };
  }

  applyFormat(targetFormats = {}) {
    if (!this.hasFormat()) {
      return { ...targetFormats };
    }
    const applied = { ...targetFormats, ...this.storedFormat };
    this.clear();
    return applied;
  }

  clear() {
    this.storedFormat = null;
    this.active = false;
  }

  hasFormat() {
    return this.active && this.storedFormat !== null;
  }

  getFormat() {
    return this.storedFormat ? { ...this.storedFormat } : null;
  }
}

/**
 * Generates custom table HTML for rich text insertion.
 * @param {number} [rows=3] - Number of table rows (minimum 1)
 * @param {number} [cols=3] - Number of table columns (minimum 1)
 * @param {object} [options={}] - Custom styling options
 * @returns {string} HTML markup for table
 */
export function generateTableHTML(rows = 3, cols = 3, options = {}) {
  const rCount = Math.max(1, parseInt(rows, 10) || 1);
  const cCount = Math.max(1, parseInt(cols, 10) || 1);
  const cellPadding = options.cellPadding || '8px 12px';
  const borderColor = options.borderColor || '#cccccc';

  let tableHtml = `<table style="width:100%;border-collapse:collapse;margin:12px 0;"><tbody>`;
  for (let r = 0; r < rCount; r++) {
    tableHtml += '<tr>';
    for (let c = 0; c < cCount; c++) {
      tableHtml += `<td style="border:1px solid ${borderColor};padding:${cellPadding};min-width:60px;">&nbsp;</td>`;
    }
    tableHtml += '</tr>';
  }
  tableHtml += '</tbody></table><p><br></p>';
  return tableHtml;
}

/**
 * Wraps link in HTML markup with security attributes.
 * @param {string} text - Anchor text
 * @param {string} url - Target URL
 * @returns {string} Link HTML
 */
export function createLinkHTML(text, url) {
  const safeUrl = (url || '').replace(/"/g, '&quot;');
  return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${text || url || ''}</a>`;
}

/**
 * Wraps image in responsive HTML markup.
 * @param {string} src - Image source URI
 * @param {string} [alt=''] - Alt text description
 * @returns {string} Image HTML
 */
export function createImageHTML(src, alt = '') {
  const safeSrc = (src || '').replace(/"/g, '&quot;');
  const safeAlt = (alt || '').replace(/"/g, '&quot;');
  return `<img src="${safeSrc}" alt="${safeAlt}" style="max-width:100%;border-radius:4px;cursor:pointer;" />`;
}
