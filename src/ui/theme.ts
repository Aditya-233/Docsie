/**
 * Theme and Page Color Management Module for Google Docs Clone.
 */

export const THEMES = Object.freeze({
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system'
} as const);

export type ThemeType = typeof THEMES[keyof typeof THEMES];

export const THEME_STORAGE_KEY = 'gdocs_theme_mode';
export const PAGE_COLOR_STORAGE_KEY = 'gdocs_page_color';

export const PAGE_COLOR_PALETTE: readonly { name: string; value: string; textColor: string }[] = Object.freeze([
  { name: 'White', value: '#ffffff', textColor: '#1f1f1f' },
  { name: 'Light Gray', value: '#f1f3f4', textColor: '#1f1f1f' },
  { name: 'Off-White Cream', value: '#fdfbf7', textColor: '#1f1f1f' },
  { name: 'Soft Vanilla', value: '#fff9e6', textColor: '#1f1f1f' },
  { name: 'Soft Mint', value: '#e6f4ea', textColor: '#1f1f1f' },
  { name: 'Soft Sky', value: '#e8f0fe', textColor: '#1f1f1f' },
  { name: 'Soft Coral', value: '#fce8e6', textColor: '#1f1f1f' },
  { name: 'Soft Lavender', value: '#f3e8fd', textColor: '#1f1f1f' },
  { name: 'Dark Charcoal', value: '#1e1f20', textColor: '#e3e3e3' },
  { name: 'Deep Navy', value: '#1a1f2c', textColor: '#e3e3e3' }
]);

const memoryStorage = new Map<string, string>();

function getStorageItem(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
  } catch (_e) {}
  return memoryStorage.get(key) || null;
}

function setStorageItem(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
      return;
    }
  } catch (_e) {}
  memoryStorage.set(key, String(value));
}

function removeStorageItem(key: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
      return;
    }
  } catch (_e) {}
  memoryStorage.delete(key);
}

export function detectSystemTheme(): 'dark' | 'light' {
  if (typeof window !== 'undefined' && window.matchMedia) {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return isDark ? 'dark' : 'light';
  }
  return 'light';
}

export class ThemeManager {
  public defaultTheme: string;
  public defaultPageColor: string;
  public currentTheme: string;
  public currentPageColor: string;
  public listeners: Map<string, Set<Function>>;

  constructor(options: { defaultTheme?: string; defaultPageColor?: string } = {}) {
    this.defaultTheme = options.defaultTheme || THEMES.LIGHT;
    this.defaultPageColor = options.defaultPageColor || '#ffffff';
    this.listeners = new Map();

    this.currentTheme = getStorageItem(THEME_STORAGE_KEY) || this.defaultTheme;
    this.currentPageColor = getStorageItem(PAGE_COLOR_STORAGE_KEY) || this.defaultPageColor;

    if (typeof window !== 'undefined' && window.matchMedia) {
      try {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener('change', () => {
          if (this.currentTheme === THEMES.SYSTEM) {
            this.applyToDOM();
            this.emit('themeChange', this.getEffectiveTheme());
          }
        });
      } catch (_e) {}
    }
  }

  on(event: string, callback: Function): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(callback);
    return () => this.off(event, callback);
  }

  off(event: string, callback: Function): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(callback);
    }
  }

  emit(event: string, ...args: unknown[]): void {
    const set = this.listeners.get(event);
    if (set) {
      for (const callback of set) {
        try {
          callback(...args);
        } catch (err) {
          console.error(`Error in theme listener "${event}":`, err);
        }
      }
    }
  }

  getTheme(): string {
    return this.currentTheme;
  }

  getEffectiveTheme(): 'light' | 'dark' {
    if (this.currentTheme === THEMES.SYSTEM) {
      return detectSystemTheme();
    }
    return this.currentTheme === THEMES.DARK ? 'dark' : 'light';
  }

  isDarkMode(): boolean {
    return this.getEffectiveTheme() === 'dark';
  }

  setTheme(themeName: string): 'light' | 'dark' {
    const validThemes = Object.values(THEMES);
    const target = validThemes.includes(themeName as any) ? themeName : THEMES.LIGHT;

    this.currentTheme = target;
    setStorageItem(THEME_STORAGE_KEY, target);

    this.applyToDOM();
    const effective = this.getEffectiveTheme();
    this.emit('themeChange', effective, target);
    return effective;
  }

  toggleTheme(): 'light' | 'dark' {
    const effective = this.getEffectiveTheme();
    const newTheme = effective === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
    return this.setTheme(newTheme);
  }

  getPageColor(): string {
    return this.currentPageColor;
  }

  setPageColor(colorHex: string, pageElement: HTMLElement | null = null): string {
    if (!colorHex || typeof colorHex !== 'string') return this.currentPageColor;

    this.currentPageColor = colorHex;
    setStorageItem(PAGE_COLOR_STORAGE_KEY, colorHex);

    if (pageElement && pageElement.style) {
      pageElement.style.backgroundColor = colorHex;
    }

    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--page-bg', colorHex);
    }

    this.emit('pageColorChange', colorHex);
    return colorHex;
  }

  resetPageColor(pageElement: HTMLElement | null = null): string {
    removeStorageItem(PAGE_COLOR_STORAGE_KEY);
    this.currentPageColor = this.defaultPageColor;

    if (pageElement && pageElement.style) {
      pageElement.style.backgroundColor = '';
    }

    if (typeof document !== 'undefined') {
      document.documentElement.style.removeProperty('--page-bg');
    }

    this.emit('pageColorChange', this.defaultPageColor);
    return this.defaultPageColor;
  }

  applyToDOM(): void {
    if (typeof document === 'undefined') return;

    const effective = this.getEffectiveTheme();
    if (document.body) {
      document.body.setAttribute('data-theme', effective);
    }
    if (document.documentElement) {
      document.documentElement.setAttribute('data-theme', effective);
    }
  }
}

export const themeManager = new ThemeManager();

export const getTheme = () => themeManager.getTheme();
export const getEffectiveTheme = () => themeManager.getEffectiveTheme();
export const setTheme = (t: string) => themeManager.setTheme(t);
export const toggleTheme = () => themeManager.toggleTheme();
export const getPageColor = () => themeManager.getPageColor();
export const setPageColor = (c: string, el: HTMLElement | null = null) => themeManager.setPageColor(c, el);
export const resetPageColor = (el: HTMLElement | null = null) => themeManager.resetPageColor(el);
