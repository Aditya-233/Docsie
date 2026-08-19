/**
 * Interactive Ruler, Margins Calculator, and Drag Physics Engine
 * for Google Docs Clone.
 */

import type { RulerMargins } from '../types/index.ts';

export const DPI = 96;

export const PAGE_PRESETS = Object.freeze({
  LETTER: { name: 'Letter (8.5 × 11 in)', widthInches: 8.5, heightInches: 11.0, widthPx: 816, heightPx: 1056 },
  A4: { name: 'A4 (210 × 297 mm)', widthInches: 8.27, heightInches: 11.69, widthPx: 794, heightPx: 1123 },
  LEGAL: { name: 'Legal (8.5 × 14 in)', widthInches: 8.5, heightInches: 14.0, widthPx: 816, heightPx: 1344 },
  EXECUTIVE: { name: 'Executive (7.25 × 10.5 in)', widthInches: 7.25, heightInches: 10.5, widthPx: 696, heightPx: 1008 }
});

export const MARGIN_PRESETS = Object.freeze({
  NORMAL: { name: 'Normal (1 in)', top: 1.0, right: 1.0, bottom: 1.0, left: 1.0 },
  NARROW: { name: 'Narrow (0.5 in)', top: 0.5, right: 0.5, bottom: 0.5, left: 0.5 },
  MODERATE: { name: 'Moderate (0.75 in)', top: 1.0, right: 0.75, bottom: 1.0, left: 0.75 },
  WIDE: { name: 'Wide (2 in)', top: 1.0, right: 2.0, bottom: 1.0, left: 2.0 }
});

export const MIN_CONTENT_WIDTH_PX = 96;
export const SNAP_TICK_STEP_PX = 6;

export function inchesToPx(inches: number, dpi: number = DPI): number {
  if (typeof inches !== 'number' || isNaN(inches)) return 0;
  return Math.round(inches * dpi * 100) / 100;
}

export function pxToInches(px: number, dpi: number = DPI): number {
  if (typeof px !== 'number' || isNaN(px)) return 0;
  return Math.round((px / dpi) * 100) / 100;
}

export function mmToPx(mm: number, dpi: number = DPI): number {
  if (typeof mm !== 'number' || isNaN(mm)) return 0;
  return Math.round(((mm / 25.4) * dpi) * 100) / 100;
}

export function pxToMm(px: number, dpi: number = DPI): number {
  if (typeof px !== 'number' || isNaN(px)) return 0;
  return Math.round(((px / dpi) * 25.4) * 100) / 100;
}

export function ptToPx(pt: number, dpi: number = DPI): number {
  if (typeof pt !== 'number' || isNaN(pt)) return 0;
  return Math.round(((pt / 72) * dpi) * 100) / 100;
}

export function pxToPt(px: number, dpi: number = DPI): number {
  if (typeof px !== 'number' || isNaN(px)) return 0;
  return Math.round(((px / dpi) * 72) * 100) / 100;
}

export function clampMargin(value: number, min: number = 0, max: number = Infinity): number {
  if (typeof value !== 'number' || isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}

export function snapToGrid(value: number, step: number = SNAP_TICK_STEP_PX): number {
  if (!step || step <= 0) return value;
  return Math.round(value / step) * step;
}

export interface DragConstraintsParams {
  markerType: 'left' | 'firstLine' | 'right';
  clientX: number;
  rulerRect: { left?: number; width?: number };
  currentLeft?: number;
  currentFirstLine?: number;
  currentRight?: number;
  minContentWidth?: number;
  snap?: boolean;
  snapStep?: number;
}

export function calculateDragConstraints(params: DragConstraintsParams) {
  const {
    markerType,
    clientX,
    rulerRect,
    currentLeft = 72,
    currentFirstLine = 72,
    currentRight = 72,
    minContentWidth = MIN_CONTENT_WIDTH_PX,
    snap = false,
    snapStep = SNAP_TICK_STEP_PX
  } = params;

  const rulerWidth = rulerRect.width || 816;
  const rulerLeft = rulerRect.left || 0;

  let rawOffset = clientX - rulerLeft;
  if (snap) {
    rawOffset = snapToGrid(rawOffset, snapStep);
  }

  let leftMargin = currentLeft;
  let firstLineMarker = currentFirstLine;
  let rightMargin = currentRight;

  if (markerType === 'left') {
    const maxLeft = rulerWidth - rightMargin - minContentWidth;
    const newLeft = clampMargin(rawOffset, 0, maxLeft);
    const delta = newLeft - leftMargin;

    leftMargin = newLeft;
    firstLineMarker = clampMargin(firstLineMarker + delta, 0, rulerWidth - rightMargin - 20);
  } else if (markerType === 'firstLine') {
    const maxFirstLine = rulerWidth - rightMargin - 20;
    firstLineMarker = clampMargin(rawOffset, 0, maxFirstLine);
  } else if (markerType === 'right') {
    const rawRight = rulerWidth - rawOffset;
    const maxRight = rulerWidth - leftMargin - minContentWidth;
    rightMargin = clampMargin(rawRight, 0, maxRight);
  }

  const firstLineIndentOffset = firstLineMarker - leftMargin;
  const contentWidth = rulerWidth - leftMargin - rightMargin;

  return {
    leftMargin: Math.round(leftMargin),
    firstLineMarker: Math.round(firstLineMarker),
    firstLineIndentOffset: Math.round(firstLineIndentOffset),
    rightMargin: Math.round(rightMargin),
    contentWidth: Math.round(contentWidth)
  };
}

export class RulerManager {
  public pageWidthPx: number;
  public pageHeightPx: number;
  public dpi: number;
  public minContentWidth: number;
  public margins: {
    top: number;
    right: number;
    bottom: number;
    left: number;
    firstLineIndent: number;
  };

  constructor(options: {
    pageWidthPx?: number;
    pageHeightPx?: number;
    dpi?: number;
    minContentWidth?: number;
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
    firstLineIndent?: number;
  } = {}) {
    this.pageWidthPx = options.pageWidthPx || PAGE_PRESETS.LETTER.widthPx;
    this.pageHeightPx = options.pageHeightPx || PAGE_PRESETS.LETTER.heightPx;
    this.dpi = options.dpi || DPI;
    this.minContentWidth = options.minContentWidth || MIN_CONTENT_WIDTH_PX;

    this.margins = {
      top: options.top !== undefined ? options.top : 72,
      right: options.right !== undefined ? options.right : 72,
      bottom: options.bottom !== undefined ? options.bottom : 72,
      left: options.left !== undefined ? options.left : 72,
      firstLineIndent: options.firstLineIndent !== undefined ? options.firstLineIndent : 0
    };
  }

  setMargins(margins: Partial<RulerMargins> = {}): RulerMargins {
    if (margins.top !== undefined) this.margins.top = clampMargin(margins.top, 0, this.pageHeightPx - 100);
    if (margins.bottom !== undefined) this.margins.bottom = clampMargin(margins.bottom, 0, this.pageHeightPx - 100);
    if (margins.left !== undefined) this.margins.left = clampMargin(margins.left, 0, this.pageWidthPx - this.margins.right - this.minContentWidth);
    if (margins.right !== undefined) this.margins.right = clampMargin(margins.right, 0, this.pageWidthPx - this.margins.left - this.minContentWidth);
    if (margins.firstLineIndent !== undefined) this.margins.firstLineIndent = margins.firstLineIndent;
    return this.getMargins();
  }

  setMarginsInches(inchesMargins: Partial<RulerMargins> = {}): RulerMargins {
    const pxMargins: Partial<RulerMargins> = {};
    if (inchesMargins.top !== undefined) pxMargins.top = inchesToPx(inchesMargins.top, this.dpi);
    if (inchesMargins.right !== undefined) pxMargins.right = inchesToPx(inchesMargins.right, this.dpi);
    if (inchesMargins.bottom !== undefined) pxMargins.bottom = inchesToPx(inchesMargins.bottom, this.dpi);
    if (inchesMargins.left !== undefined) pxMargins.left = inchesToPx(inchesMargins.left, this.dpi);
    return this.setMargins(pxMargins);
  }

  getMargins(): RulerMargins {
    return { ...this.margins };
  }

  getMarginsInches(): RulerMargins {
    return {
      top: pxToInches(this.margins.top, this.dpi),
      right: pxToInches(this.margins.right, this.dpi),
      bottom: pxToInches(this.margins.bottom, this.dpi),
      left: pxToInches(this.margins.left, this.dpi),
      firstLineIndent: pxToInches(this.margins.firstLineIndent, this.dpi)
    };
  }

  handleDrag(
    markerType: 'left' | 'firstLine' | 'right',
    clientX: number,
    rulerRect: { left?: number; width?: number },
    snap: boolean = false
  ) {
    const currentFirstLine = this.margins.left + this.margins.firstLineIndent;
    const result = calculateDragConstraints({
      markerType,
      clientX,
      rulerRect: { width: this.pageWidthPx, ...rulerRect },
      currentLeft: this.margins.left,
      currentFirstLine,
      currentRight: this.margins.right,
      minContentWidth: this.minContentWidth,
      snap
    });

    this.margins.left = result.leftMargin;
    this.margins.right = result.rightMargin;
    this.margins.firstLineIndent = result.firstLineIndentOffset;

    return result;
  }

  applyToPageElement(pageElement: HTMLElement): void {
    if (!pageElement || typeof pageElement.style === 'undefined') return;
    pageElement.style.paddingTop = `${this.margins.top}px`;
    pageElement.style.paddingRight = `${this.margins.right}px`;
    pageElement.style.paddingBottom = `${this.margins.bottom}px`;
    pageElement.style.paddingLeft = `${this.margins.left}px`;
  }
}
