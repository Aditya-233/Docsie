/**
 * Core Editor Wrapper for Google Docs Clone.
 * Manages typography whitelists, format attributes, table insertion, format painter, and history.
 */

import type { QuillFormat } from '../types/index.ts';

export const FONT_SIZES_WHITELIST: readonly string[] = [
  '10px', '12px', '14px', '15px', '16px', '18px', '22px', '28px', '36px', '48px', '72px'
];

export const FONT_FAMILIES_WHITELIST: readonly string[] = [
  'Roboto', 'Inter', 'Merriweather', 'Playfair Display', 'Lora', 'Montserrat', 'Fira Code', 'Caveat', 'Comic Neue'
];

export interface HeadingLevel {
  label: string;
  value: number | boolean;
  tag: string;
}

export const HEADING_LEVELS: readonly HeadingLevel[] = [
  { label: 'Normal text', value: false, tag: 'p' },
  { label: 'Heading 1', value: 1, tag: 'h1' },
  { label: 'Heading 2', value: 2, tag: 'h2' },
  { label: 'Heading 3', value: 3, tag: 'h3' }
];

export const FORMAT_TOGGLES: readonly string[] = ['bold', 'italic', 'underline', 'strike'];

export function toggleFormatState(currentFormats: QuillFormat = {}, formatKey: string): QuillFormat {
  const next = { ...currentFormats };
  if (next[formatKey]) {
    delete next[formatKey];
  } else {
    next[formatKey] = true;
  }
  return next;
}

export function getHeadingTag(level: unknown): string {
  if (level === 1 || level === '1') return 'h1';
  if (level === 2 || level === '2') return 'h2';
  if (level === 3 || level === '3') return 'h3';
  return 'p';
}

export function isValidHeadingLevel(level: unknown): boolean {
  return level === false || level === 1 || level === 2 || level === 3 || level === '1' || level === '2' || level === '3' || level === 'normal';
}

export class FormatPainter {
  private storedFormat: QuillFormat | null;
  private active: boolean;

  constructor() {
    this.storedFormat = null;
    this.active = false;
  }

  copyFormat(formatMap: QuillFormat | null): QuillFormat | null {
    if (!formatMap || typeof formatMap !== 'object') {
      this.clear();
      return null;
    }
    this.storedFormat = { ...formatMap };
    this.active = true;
    return { ...this.storedFormat };
  }

  applyFormat(targetFormats: QuillFormat = {}): QuillFormat {
    if (!this.hasFormat()) {
      return { ...targetFormats };
    }
    const applied = { ...targetFormats, ...this.storedFormat };
    this.clear();
    return applied;
  }

  clear(): void {
    this.storedFormat = null;
    this.active = false;
  }

  hasFormat(): boolean {
    return this.active && this.storedFormat !== null;
  }

  getFormat(): QuillFormat | null {
    return this.storedFormat ? { ...this.storedFormat } : null;
  }
}

export function generateTableHTML(rows: number = 3, cols: number = 3, options: { cellPadding?: string; borderColor?: string } = {}): string {
  const rCount = Math.max(1, parseInt(String(rows), 10) || 1);
  const cCount = Math.max(1, parseInt(String(cols), 10) || 1);
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

export function createLinkHTML(text: string, url: string): string {
  const safeUrl = (url || '').replace(/"/g, '&quot;');
  return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${text || url || ''}</a>`;
}

export function createImageHTML(src: string, alt: string = ''): string {
  const safeSrc = (src || '').replace(/"/g, '&quot;');
  const safeAlt = (alt || '').replace(/"/g, '&quot;');
  return `<img src="${safeSrc}" alt="${safeAlt}" style="max-width:100%;border-radius:4px;cursor:pointer;" />`;
}
