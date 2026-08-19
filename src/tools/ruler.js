/**
 * Interactive Ruler, Margins Calculator, and Drag Physics Engine
 * for Google Docs Clone.
 * 
 * Computes unit conversions (inches, mm, pt, px at 96 DPI), margin clamping,
 * and handles boundary constraints and snap physics for ruler markers.
 */

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

export const MIN_CONTENT_WIDTH_PX = 96; // 1.0 inch minimum content area
export const SNAP_TICK_STEP_PX = 6;     // 1/16th inch at 96 DPI

/* ==========================================================================
   1. UNIT CONVERSION HELPERS
   ========================================================================== */

/**
 * Convert inches to CSS pixels.
 * @param {number} inches - Measurement in inches
 * @param {number} [dpi=96] - Screen DPI
 * @returns {number} Value in pixels
 */
export function inchesToPx(inches, dpi = DPI) {
  if (typeof inches !== 'number' || isNaN(inches)) return 0;
  return Math.round(inches * dpi * 100) / 100;
}

/**
 * Convert CSS pixels to inches.
 * @param {number} px - Measurement in pixels
 * @param {number} [dpi=96] - Screen DPI
 * @returns {number} Value in inches
 */
export function pxToInches(px, dpi = DPI) {
  if (typeof px !== 'number' || isNaN(px)) return 0;
  return Math.round((px / dpi) * 100) / 100;
}

/**
 * Convert millimeters to CSS pixels.
 * @param {number} mm - Measurement in millimeters
 * @param {number} [dpi=96] - Screen DPI
 * @returns {number} Value in pixels
 */
export function mmToPx(mm, dpi = DPI) {
  if (typeof mm !== 'number' || isNaN(mm)) return 0;
  return Math.round(((mm / 25.4) * dpi) * 100) / 100;
}

/**
 * Convert CSS pixels to millimeters.
 * @param {number} px - Measurement in pixels
 * @param {number} [dpi=96] - Screen DPI
 * @returns {number} Value in millimeters
 */
export function pxToMm(px, dpi = DPI) {
  if (typeof px !== 'number' || isNaN(px)) return 0;
  return Math.round(((px / dpi) * 25.4) * 100) / 100;
}

/**
 * Convert typographical points (pt) to CSS pixels.
 * @param {number} pt - Measurement in points (72 pt = 1 in)
 * @param {number} [dpi=96] - Screen DPI
 * @returns {number} Value in pixels
 */
export function ptToPx(pt, dpi = DPI) {
  if (typeof pt !== 'number' || isNaN(pt)) return 0;
  return Math.round(((pt / 72) * dpi) * 100) / 100;
}

/**
 * Convert CSS pixels to typographical points.
 * @param {number} px - Measurement in pixels
 * @param {number} [dpi=96] - Screen DPI
 * @returns {number} Value in points
 */
export function pxToPt(px, dpi = DPI) {
  if (typeof px !== 'number' || isNaN(px)) return 0;
  return Math.round(((px / dpi) * 72) * 100) / 100;
}

/* ==========================================================================
   2. MARGIN CLAMPING & SNAPPING
   ========================================================================== */

/**
 * Clamp a numeric value between minimum and maximum bounds.
 * @param {number} value - Input value
 * @param {number} min - Lower bound
 * @param {number} max - Upper bound
 * @returns {number} Clamped value
 */
export function clampMargin(value, min = 0, max = Infinity) {
  if (typeof value !== 'number' || isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}

/**
 * Snap a pixel value to the nearest grid step.
 * @param {number} value - Pixel value
 * @param {number} [step=6] - Grid step in pixels (e.g. 6px = 1/16 in, 12px = 1/8 in)
 * @returns {number} Snapped pixel value
 */
export function snapToGrid(value, step = SNAP_TICK_STEP_PX) {
  if (!step || step <= 0) return value;
  return Math.round(value / step) * step;
}

/* ==========================================================================
   3. DRAG PHYSICS & BOUNDARY CONSTRAINTS
   ========================================================================== */

/**
 * Calculate constrained positions during ruler marker dragging.
 * 
 * Enforces:
 * 1. Left margin cannot cross right margin (maintaining MIN_CONTENT_WIDTH).
 * 2. Right margin cannot cross left margin.
 * 3. First-line indent can offset positively (indent) or negatively (hanging indent)
 *    within ruler bounds.
 * 
 * @param {object} params - Calculation parameters
 * @param {'left'|'firstLine'|'right'} params.markerType - Dragged marker
 * @param {number} params.clientX - Pointer X coordinate
 * @param {{ left: number, width: number }} params.rulerRect - Ruler bounding rectangle
 * @param {number} params.currentLeft - Current left margin in px
 * @param {number} params.currentFirstLine - Current first-line indent marker position in px
 * @param {number} params.currentRight - Current right margin in px
 * @param {number} [params.minContentWidth=96] - Minimum printable content width
 * @param {boolean} [params.snap=false] - Whether to snap to 1/16 in grid
 * @param {number} [params.snapStep=6] - Snap step in px
 * @returns {{
 *   leftMargin: number,
 *   firstLineMarker: number,
 *   firstLineIndentOffset: number,
 *   rightMargin: number,
 *   contentWidth: number
 * }}
 */
export function calculateDragConstraints(params) {
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

  // Raw horizontal offset inside ruler
  let rawOffset = clientX - rulerLeft;
  if (snap) {
    rawOffset = snapToGrid(rawOffset, snapStep);
  }

  let leftMargin = currentLeft;
  let firstLineMarker = currentFirstLine;
  let rightMargin = currentRight;

  if (markerType === 'left') {
    // Left Margin Drag
    const maxLeft = rulerWidth - rightMargin - minContentWidth;
    const newLeft = clampMargin(rawOffset, 0, maxLeft);
    const delta = newLeft - leftMargin;

    leftMargin = newLeft;
    // First line marker moves alongside left margin to preserve relative indent offset
    firstLineMarker = clampMargin(firstLineMarker + delta, 0, rulerWidth - rightMargin - 20);
  } else if (markerType === 'firstLine') {
    // First Line Indent Drag
    const maxFirstLine = rulerWidth - rightMargin - 20;
    firstLineMarker = clampMargin(rawOffset, 0, maxFirstLine);
  } else if (markerType === 'right') {
    // Right Margin Drag (measured from ruler right edge)
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

/* ==========================================================================
   4. RULER MODEL CONTROLLER CLASS
   ========================================================================== */

/**
 * Ruler and Margins State Manager.
 */
export class RulerManager {
  constructor(options = {}) {
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

  /**
   * Set margins in pixels.
   * @param {object} margins - Partial or full margins { top, right, bottom, left, firstLineIndent }
   */
  setMargins(margins = {}) {
    if (margins.top !== undefined) this.margins.top = clampMargin(margins.top, 0, this.pageHeightPx - 100);
    if (margins.bottom !== undefined) this.margins.bottom = clampMargin(margins.bottom, 0, this.pageHeightPx - 100);
    if (margins.left !== undefined) this.margins.left = clampMargin(margins.left, 0, this.pageWidthPx - this.margins.right - this.minContentWidth);
    if (margins.right !== undefined) this.margins.right = clampMargin(margins.right, 0, this.pageWidthPx - this.margins.left - this.minContentWidth);
    if (margins.firstLineIndent !== undefined) this.margins.firstLineIndent = margins.firstLineIndent;
    return this.getMargins();
  }

  /**
   * Set margins using inch values.
   * @param {{ top: number, right: number, bottom: number, left: number }} inchesMargins
   */
  setMarginsInches(inchesMargins = {}) {
    const pxMargins = {};
    if (inchesMargins.top !== undefined) pxMargins.top = inchesToPx(inchesMargins.top, this.dpi);
    if (inchesMargins.right !== undefined) pxMargins.right = inchesToPx(inchesMargins.right, this.dpi);
    if (inchesMargins.bottom !== undefined) pxMargins.bottom = inchesToPx(inchesMargins.bottom, this.dpi);
    if (inchesMargins.left !== undefined) pxMargins.left = inchesToPx(inchesMargins.left, this.dpi);
    return this.setMargins(pxMargins);
  }

  /**
   * Get current margins in pixels.
   * @returns {{ top: number, right: number, bottom: number, left: number, firstLineIndent: number }}
   */
  getMargins() {
    return { ...this.margins };
  }

  /**
   * Get current margins converted to inches.
   * @returns {{ top: number, right: number, bottom: number, left: number, firstLineIndent: number }}
   */
  getMarginsInches() {
    return {
      top: pxToInches(this.margins.top, this.dpi),
      right: pxToInches(this.margins.right, this.dpi),
      bottom: pxToInches(this.margins.bottom, this.dpi),
      left: pxToInches(this.margins.left, this.dpi),
      firstLineIndent: pxToInches(this.margins.firstLineIndent, this.dpi)
    };
  }

  /**
   * Compute drag physics for marker movement.
   * @param {'left'|'firstLine'|'right'} markerType - Dragged marker
   * @param {number} clientX - Pointer X
   * @param {{ left: number, width: number }} rulerRect - Ruler bounding rectangle
   * @param {boolean} [snap=false] - Snap to tick grid
   * @returns {object} Calculated constraint results
   */
  handleDrag(markerType, clientX, rulerRect, snap = false) {
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

  /**
   * Apply margin styles to DOM page container.
   * @param {HTMLElement} pageElement - Target page DOM element
   */
  applyToPageElement(pageElement) {
    if (!pageElement || typeof pageElement.style === 'undefined') return;
    pageElement.style.paddingTop = `${this.margins.top}px`;
    pageElement.style.paddingRight = `${this.margins.right}px`;
    pageElement.style.paddingBottom = `${this.margins.bottom}px`;
    pageElement.style.paddingLeft = `${this.margins.left}px`;
  }
}
