/**
 * Find and Replace Engine for Google Docs Clone.
 * 
 * Provides position-aware search, multi-criteria matching (case sensitive,
 * whole word, regex), cyclical navigation, single replace, and batch replace all.
 */

/**
 * Escape special characters in a string for use in a Regular Expression.
 * @param {string} str - Literal query string
 * @returns {string} Escaped string
 */
export function escapeRegex(str) {
  if (!str) return '';
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Compute line start offset indices for fast line/column coordinate lookup.
 * @param {string} text - Source text
 * @returns {number[]} Array of 0-based character offsets where each line starts
 */
export function getLineStartOffsets(text) {
  const offsets = [0];
  if (!text) return offsets;

  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') {
      offsets.push(i + 1);
    }
  }
  return offsets;
}

/**
 * Calculate 1-based line and column from a character index using line offsets.
 * @param {number} charIndex - 0-based character index
 * @param {number[]} lineOffsets - Array of line start offsets
 * @returns {{ line: number, column: number }} 1-based line and column coordinates
 */
export function getCoordinates(charIndex, lineOffsets) {
  if (!lineOffsets || lineOffsets.length === 0 || charIndex < 0) {
    return { line: 1, column: 1 };
  }

  // Binary search for the line index
  let low = 0;
  let high = lineOffsets.length - 1;
  let lineIdx = 0;

  while (low <= high) {
    const mid = (low + high) >> 1;
    if (lineOffsets[mid] <= charIndex) {
      lineIdx = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  const lineStart = lineOffsets[lineIdx];
  const column = (charIndex - lineStart) + 1;
  const line = lineIdx + 1;

  return { line, column };
}

/**
 * Find all occurrences of query in source text with exact positions.
 * @param {string} text - Target text to search within
 * @param {string} query - Search query string or pattern
 * @param {object} [options] - Search options
 * @param {boolean} [options.caseSensitive=false] - Case sensitive search
 * @param {boolean} [options.wholeWord=false] - Match whole words only
 * @param {boolean} [options.isRegex=false] - Treat query as a regex pattern
 * @returns {Array<{ index: number, length: number, text: string, line: number, column: number }>}
 */
export function findMatches(text, query, options = {}) {
  if (typeof text !== 'string' || !query || typeof query !== 'string') {
    return [];
  }

  const {
    caseSensitive = false,
    wholeWord = false,
    isRegex = false
  } = options;

  let patternStr = '';

  if (isRegex) {
    patternStr = query;
  } else {
    patternStr = escapeRegex(query);
  }

  if (wholeWord) {
    patternStr = `\\b${patternStr}\\b`;
  }

  let regex;
  try {
    const flags = caseSensitive ? 'g' : 'gi';
    regex = new RegExp(patternStr, flags);
  } catch (err) {
    console.warn('Invalid regex in search query:', err);
    return [];
  }

  const matches = [];
  const lineOffsets = getLineStartOffsets(text);
  let match;

  while ((match = regex.exec(text)) !== null) {
    const matchText = match[0];
    const matchLength = matchText.length;

    // Prevent infinite loop on 0-length regex matches
    if (matchLength === 0) {
      regex.lastIndex++;
      continue;
    }

    const index = match.index;
    const { line, column } = getCoordinates(index, lineOffsets);

    matches.push({
      index,
      length: matchLength,
      text: matchText,
      line,
      column
    });
  }

  return matches;
}

/**
 * Replace a single match in source text.
 * @param {string} text - Source text
 * @param {{ index: number, length: number }} match - Match descriptor
 * @param {string} replacement - Replacement text
 * @returns {string} Updated text
 */
export function replaceInText(text, match, replacement) {
  if (typeof text !== 'string' || !match || typeof match.index !== 'number') {
    return text;
  }
  const repl = replacement !== undefined && replacement !== null ? String(replacement) : '';
  const before = text.slice(0, match.index);
  const after = text.slice(match.index + match.length);
  return before + repl + after;
}

/**
 * Replace all occurrences of query in source text.
 * @param {string} text - Source text
 * @param {string} query - Query string
 * @param {string} replacement - Replacement string
 * @param {object} [options] - Search options
 * @returns {{ newText: string, count: number }}
 */
export function replaceAllInText(text, query, replacement = '', options = {}) {
  if (typeof text !== 'string' || !query) {
    return { newText: text || '', count: 0 };
  }

  const matches = findMatches(text, query, options);
  if (matches.length === 0) {
    return { newText: text, count: 0 };
  }

  const repl = replacement !== undefined && replacement !== null ? String(replacement) : '';
  let result = '';
  let lastIndex = 0;

  for (const match of matches) {
    result += text.slice(lastIndex, match.index) + repl;
    lastIndex = match.index + match.length;
  }
  result += text.slice(lastIndex);

  return {
    newText: result,
    count: matches.length
  };
}

/**
 * Interactive Find and Replace Controller Class
 */
export class FindReplaceEngine {
  constructor(text = '', options = {}) {
    this.text = text;
    this.query = '';
    this.options = {
      caseSensitive: false,
      wholeWord: false,
      isRegex: false,
      ...options
    };
    this.matches = [];
    this.currentIndex = -1;
  }

  /**
   * Set source text and re-execute active search.
   * @param {string} text - Source text
   * @returns {Array<object>} Current matches
   */
  setText(text) {
    this.text = typeof text === 'string' ? text : '';
    if (this.query) {
      return this.search(this.query, this.options);
    }
    this.matches = [];
    this.currentIndex = -1;
    return [];
  }

  /**
   * Get active source text.
   * @returns {string}
   */
  getText() {
    return this.text;
  }

  /**
   * Execute search for a query with options.
   * @param {string} query - Search term
   * @param {object} [options] - Options
   * @returns {Array<object>} Matches list
   */
  search(query, options = {}) {
    this.query = query || '';
    this.options = { ...this.options, ...options };

    if (!this.query || !this.text) {
      this.matches = [];
      this.currentIndex = -1;
      return [];
    }

    this.matches = findMatches(this.text, this.query, this.options);
    this.currentIndex = this.matches.length > 0 ? 0 : -1;
    return this.matches;
  }

  /**
   * Move to next match (cyclical).
   * @returns {object|null} Next match or null
   */
  next() {
    if (this.matches.length === 0) return null;
    this.currentIndex = (this.currentIndex + 1) % this.matches.length;
    return this.getCurrentMatch();
  }

  /**
   * Move to previous match (cyclical).
   * @returns {object|null} Previous match or null
   */
  previous() {
    if (this.matches.length === 0) return null;
    this.currentIndex = (this.currentIndex - 1 + this.matches.length) % this.matches.length;
    return this.getCurrentMatch();
  }

  /**
   * Jump to specific match index.
   * @param {number} index - 0-based match index
   * @returns {object|null} Match or null
   */
  goTo(index) {
    if (index >= 0 && index < this.matches.length) {
      this.currentIndex = index;
      return this.getCurrentMatch();
    }
    return null;
  }

  /**
   * Get current active match.
   * @returns {object|null}
   */
  getCurrentMatch() {
    if (this.currentIndex >= 0 && this.currentIndex < this.matches.length) {
      return this.matches[this.currentIndex];
    }
    return null;
  }

  /**
   * Get current index (0-based) and total match count.
   * @returns {{ current: number, total: number, display: string }}
   */
  getCount() {
    const total = this.matches.length;
    const current = total > 0 && this.currentIndex >= 0 ? this.currentIndex + 1 : 0;
    return {
      current,
      total,
      display: total > 0 ? `${current} of ${total}` : '0 of 0'
    };
  }

  /**
   * Replace currently selected match and recalculate matches.
   * @param {string} replacement - Replacement text
   * @returns {{ newText: string, replacedMatch: object|null, nextMatch: object|null }}
   */
  replaceCurrent(replacement = '') {
    const currentMatch = this.getCurrentMatch();
    if (!currentMatch) {
      return { newText: this.text, replacedMatch: null, nextMatch: null };
    }

    const repl = String(replacement);
    this.text = replaceInText(this.text, currentMatch, repl);

    const savedIndex = this.currentIndex;
    // Refresh search
    this.matches = findMatches(this.text, this.query, this.options);

    if (this.matches.length === 0) {
      this.currentIndex = -1;
    } else {
      // Keep cursor on same slot or wrap
      this.currentIndex = savedIndex < this.matches.length ? savedIndex : 0;
    }

    return {
      newText: this.text,
      replacedMatch: currentMatch,
      nextMatch: this.getCurrentMatch()
    };
  }

  /**
   * Replace all occurrences in source text.
   * @param {string} replacement - Replacement text
   * @returns {{ newText: string, count: number }}
   */
  replaceAll(replacement = '') {
    const { newText, count } = replaceAllInText(this.text, this.query, replacement, this.options);
    this.text = newText;
    this.matches = [];
    this.currentIndex = -1;
    return { newText, count };
  }

  /**
   * Clear active query and matches.
   */
  clear() {
    this.query = '';
    this.matches = [];
    this.currentIndex = -1;
  }
}
