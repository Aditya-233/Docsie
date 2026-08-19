/**
 * Theme and Page Color Management Module for Google Docs Clone.
 * 
 * Manages Light / Dark mode theme toggling, system preference detection,
 * persistence, and document page background colors.
 */

export const THEMES = Object.freeze({
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system'
});

export const THEME_STORAGE_KEY = 'gdocs_theme_mode';
export const PAGE_COLOR_STORAGE_KEY = 'gdocs_page_color';

export const PAGE_COLOR_PALETTE = Object.freeze([
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

/**
 * In-memory fallback map for storage in Node.js or restricted environments.
 */
const memoryStorage = new Map();

function getStorageItem(key) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
  } catch (e) { }
  return memoryStorage.get(key) || null;
}

function setStorageItem(key, value) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
      return;
    }
  } catch (e) { }
  memoryStorage.set(key, String(value));
}

function removeStorageItem(key) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
      return;
    }
  } catch (e) { }
  memoryStorage.delete(key);
}

/**
 * Detect OS system color scheme preference.
 * @returns {'dark'|'light'}
 */
export function detectSystemTheme() {
  if (typeof window !== 'undefined' && window.matchMedia) {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return isDark ? THEMES.DARK : THEMES.LIGHT;
  }
  return THEMES.LIGHT;
}

/**
 * Theme and Page Color Manager Class.
 */
export class ThemeManager {
  constructor(options = {}) {
    this.defaultTheme = options.defaultTheme || THEMES.LIGHT;
    this.defaultPageColor = options.defaultPageColor || '#ffffff';
    this.listeners = new Map(); // event -> Set<Function>

    // Load initial state
    this.currentTheme = getStorageItem(THEME_STORAGE_KEY) || this.defaultTheme;
    this.currentPageColor = getStorageItem(PAGE_COLOR_STORAGE_KEY) || this.defaultPageColor;

    // Listen to system theme changes if available
    if (typeof window !== 'undefined' && window.matchMedia) {
      try {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener('change', () => {
          if (this.currentTheme === THEMES.SYSTEM) {
            this.applyToDOM();
            this.emit('themeChange', this.getEffectiveTheme());
          }
        });
      } catch (e) { }
    }
  }

  /**
   * Subscribe to theme or page color events.
   * @param {'themeChange'|'pageColorChange'} event - Event name
   * @param {Function} callback - Event handler
   * @returns {Function} Unsubscribe function
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  /**
   * Unsubscribe from events.
   * @param {string} event - Event name
   * @param {Function} callback - Event handler
   */
  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  /**
   * Emit an event to registered listeners.
   * @param {string} event - Event name
   * @param {...any} args - Arguments
   */
  emit(event, ...args) {
    if (this.listeners.has(event)) {
      for (const callback of this.listeners.get(event)) {
        try {
          callback(...args);
        } catch (err) {
          console.error(`Error in theme listener "${event}":`, err);
        }
      }
    }
  }

  /**
   * Get configured theme preference ('light', 'dark', 'system').
   * @returns {string}
   */
  getTheme() {
    return this.currentTheme;
  }

  /**
   * Resolve effective active theme ('light' or 'dark').
   * If theme is 'system', resolves via matchMedia.
   * @returns {'light'|'dark'}
   */
  getEffectiveTheme() {
    if (this.currentTheme === THEMES.SYSTEM) {
      return detectSystemTheme();
    }
    return this.currentTheme === THEMES.DARK ? THEMES.DARK : THEMES.LIGHT;
  }

  /**
   * Check if effective active theme is dark.
   * @returns {boolean}
   */
  isDarkMode() {
    return this.getEffectiveTheme() === THEMES.DARK;
  }

  /**
   * Set theme preference and apply to DOM.
   * @param {'light'|'dark'|'system'} themeName - Theme to set
   * @returns {string} Effective theme
   */
  setTheme(themeName) {
    const validThemes = Object.values(THEMES);
    const target = validThemes.includes(themeName) ? themeName : THEMES.LIGHT;

    this.currentTheme = target;
    setStorageItem(THEME_STORAGE_KEY, target);

    this.applyToDOM();
    const effective = this.getEffectiveTheme();
    this.emit('themeChange', effective, target);
    return effective;
  }

  /**
   * Toggle between light and dark themes.
   * @returns {'light'|'dark'} New effective theme
   */
  toggleTheme() {
    const effective = this.getEffectiveTheme();
    const newTheme = effective === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
    return this.setTheme(newTheme);
  }

  /**
   * Get current document page background color.
   * @returns {string} Hex color string
   */
  getPageColor() {
    return this.currentPageColor;
  }

  /**
   * Set document page background color.
   * @param {string} colorHex - Hex color string (e.g. '#ffffff')
   * @param {HTMLElement} [pageElement] - Optional page element to apply to directly
   * @returns {string} Updated color
   */
  setPageColor(colorHex, pageElement = null) {
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

  /**
   * Reset page background color to default.
   * @param {HTMLElement} [pageElement] - Optional page element to reset
   * @returns {string} Default color
   */
  resetPageColor(pageElement = null) {
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

  /**
   * Apply current theme state to document DOM.
   */
  applyToDOM() {
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

// Export singleton instance
export const themeManager = new ThemeManager();

// Convenience helper functions
export const getTheme = () => themeManager.getTheme();
export const getEffectiveTheme = () => themeManager.getEffectiveTheme();
export const setTheme = (t) => themeManager.setTheme(t);
export const toggleTheme = () => themeManager.toggleTheme();
export const getPageColor = () => themeManager.getPageColor();
export const setPageColor = (c, el) => themeManager.setPageColor(c, el);
export const resetPageColor = (el) => themeManager.resetPageColor(el);
