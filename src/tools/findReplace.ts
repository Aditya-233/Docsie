/**
 * Find and Replace Engine for Google Docs Clone.
 */

export function escapeRegex(str: string): string {
  if (!str) return '';
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function getLineStartOffsets(text: string): number[] {
  const offsets = [0];
  if (!text) return offsets;

  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') {
      offsets.push(i + 1);
    }
  }
  return offsets;
}

export function getCoordinates(charIndex: number, lineOffsets: number[]): { line: number; column: number } {
  if (!lineOffsets || lineOffsets.length === 0 || charIndex < 0) {
    return { line: 1, column: 1 };
  }

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

export interface SearchMatch {
  index: number;
  length: number;
  text: string;
  line: number;
  column: number;
}

export interface SearchOptions {
  caseSensitive?: boolean;
  wholeWord?: boolean;
  isRegex?: boolean;
}

export function findMatches(text: string, query: string, options: SearchOptions = {}): SearchMatch[] {
  if (typeof text !== 'string' || !query || typeof query !== 'string') {
    return [];
  }

  const {
    caseSensitive = false,
    wholeWord = false,
    isRegex = false
  } = options;

  let patternStr = isRegex ? query : escapeRegex(query);

  if (wholeWord) {
    patternStr = `\\b${patternStr}\\b`;
  }

  let regex: RegExp;
  try {
    const flags = caseSensitive ? 'g' : 'gi';
    regex = new RegExp(patternStr, flags);
  } catch (err) {
    console.warn('Invalid regex in search query:', err);
    return [];
  }

  const matches: SearchMatch[] = [];
  const lineOffsets = getLineStartOffsets(text);
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const matchText = match[0];
    const matchLength = matchText.length;

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

export function replaceInText(text: string, match: { index: number; length: number }, replacement: string): string {
  if (typeof text !== 'string' || !match || typeof match.index !== 'number') {
    return text;
  }
  const repl = replacement !== undefined && replacement !== null ? String(replacement) : '';
  const before = text.slice(0, match.index);
  const after = text.slice(match.index + match.length);
  return before + repl + after;
}

export function replaceAllInText(text: string, query: string, replacement: string = '', options: SearchOptions = {}): { newText: string; count: number } {
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

export class FindReplaceEngine {
  public text: string;
  public query: string;
  public options: SearchOptions;
  public matches: SearchMatch[];
  public currentIndex: number;

  constructor(text: string = '', options: SearchOptions = {}) {
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

  setText(text: string): SearchMatch[] {
    this.text = typeof text === 'string' ? text : '';
    if (this.query) {
      return this.search(this.query, this.options);
    }
    this.matches = [];
    this.currentIndex = -1;
    return [];
  }

  getText(): string {
    return this.text;
  }

  search(query: string, options: SearchOptions = {}): SearchMatch[] {
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

  next(): SearchMatch | null {
    if (this.matches.length === 0) return null;
    this.currentIndex = (this.currentIndex + 1) % this.matches.length;
    return this.getCurrentMatch();
  }

  previous(): SearchMatch | null {
    if (this.matches.length === 0) return null;
    this.currentIndex = (this.currentIndex - 1 + this.matches.length) % this.matches.length;
    return this.getCurrentMatch();
  }

  goTo(index: number): SearchMatch | null {
    if (index >= 0 && index < this.matches.length) {
      this.currentIndex = index;
      return this.getCurrentMatch();
    }
    return null;
  }

  getCurrentMatch(): SearchMatch | null {
    if (this.currentIndex >= 0 && this.currentIndex < this.matches.length) {
      return this.matches[this.currentIndex];
    }
    return null;
  }

  getCount(): { current: number; total: number; display: string } {
    const total = this.matches.length;
    const current = total > 0 && this.currentIndex >= 0 ? this.currentIndex + 1 : 0;
    return {
      current,
      total,
      display: total > 0 ? `${current} of ${total}` : '0 of 0'
    };
  }

  replaceCurrent(replacement: string = ''): { newText: string; replacedMatch: SearchMatch | null; nextMatch: SearchMatch | null } {
    const currentMatch = this.getCurrentMatch();
    if (!currentMatch) {
      return { newText: this.text, replacedMatch: null, nextMatch: null };
    }

    const repl = String(replacement);
    this.text = replaceInText(this.text, currentMatch, repl);

    const savedIndex = this.currentIndex;
    this.matches = findMatches(this.text, this.query, this.options);

    if (this.matches.length === 0) {
      this.currentIndex = -1;
    } else {
      this.currentIndex = savedIndex < this.matches.length ? savedIndex : 0;
    }

    return {
      newText: this.text,
      replacedMatch: currentMatch,
      nextMatch: this.getCurrentMatch()
    };
  }

  replaceAll(replacement: string = ''): { newText: string; count: number } {
    const { newText, count } = replaceAllInText(this.text, this.query, replacement, this.options);
    this.text = newText;
    this.matches = [];
    this.currentIndex = -1;
    return { newText, count };
  }

  clear(): void {
    this.query = '';
    this.matches = [];
    this.currentIndex = -1;
  }
}
