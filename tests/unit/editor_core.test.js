import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  FONT_SIZES_WHITELIST,
  FONT_FAMILIES_WHITELIST,
  HEADING_LEVELS,
  FORMAT_TOGGLES,
  toggleFormatState,
  getHeadingTag,
  isValidHeadingLevel,
  FormatPainter,
  generateTableHTML,
  createLinkHTML,
  createImageHTML
} from '../../src/core/editor.ts';

describe('Editor Core - Typography & Whitelists', () => {
  test('font size whitelist contains standard typography scale', () => {
    assert.ok(Array.isArray(FONT_SIZES_WHITELIST));
    assert.ok(FONT_SIZES_WHITELIST.length >= 10);

    const expectedSizes = ['10px', '12px', '14px', '16px', '18px', '22px', '28px', '36px', '48px', '72px'];
    for (const size of expectedSizes) {
      assert.ok(
        FONT_SIZES_WHITELIST.includes(size),
        `Expected FONT_SIZES_WHITELIST to contain "${size}"`
      );
    }

    // Verify all entries end with 'px' and are unique
    const uniqueSizes = new Set(FONT_SIZES_WHITELIST);
    assert.equal(uniqueSizes.size, FONT_SIZES_WHITELIST.length);
    for (const size of FONT_SIZES_WHITELIST) {
      assert.match(size, /^\d+px$/);
    }
  });

  test('font family whitelist contains Google Docs standard fonts', () => {
    assert.ok(Array.isArray(FONT_FAMILIES_WHITELIST));
    assert.ok(FONT_FAMILIES_WHITELIST.length >= 8);

    const expectedFamilies = [
      'Roboto',
      'Inter',
      'Merriweather',
      'Playfair Display',
      'Lora',
      'Montserrat',
      'Fira Code',
      'Caveat',
      'Comic Neue'
    ];

    for (const font of expectedFamilies) {
      assert.ok(
        FONT_FAMILIES_WHITELIST.includes(font),
        `Expected FONT_FAMILIES_WHITELIST to contain "${font}"`
      );
    }

    // Verify uniqueness
    const uniqueFonts = new Set(FONT_FAMILIES_WHITELIST);
    assert.equal(uniqueFonts.size, FONT_FAMILIES_WHITELIST.length);
  });

  test('heading levels definition and tag mappings (H1, H2, H3, normal)', () => {
    assert.ok(Array.isArray(HEADING_LEVELS));
    assert.equal(HEADING_LEVELS.length, 4);

    const normal = HEADING_LEVELS.find((h) => h.value === false);
    assert.ok(normal);
    assert.equal(normal.tag, 'p');

    const h1 = HEADING_LEVELS.find((h) => h.value === 1);
    assert.ok(h1);
    assert.equal(h1.tag, 'h1');

    const h2 = HEADING_LEVELS.find((h) => h.value === 2);
    assert.ok(h2);
    assert.equal(h2.tag, 'h2');

    const h3 = HEADING_LEVELS.find((h) => h.value === 3);
    assert.ok(h3);
    assert.equal(h3.tag, 'h3');

    // getHeadingTag helper
    assert.equal(getHeadingTag(1), 'h1');
    assert.equal(getHeadingTag('1'), 'h1');
    assert.equal(getHeadingTag(2), 'h2');
    assert.equal(getHeadingTag('2'), 'h2');
    assert.equal(getHeadingTag(3), 'h3');
    assert.equal(getHeadingTag('3'), 'h3');
    assert.equal(getHeadingTag(false), 'p');
    assert.equal(getHeadingTag('normal'), 'p');
    assert.equal(getHeadingTag(null), 'p');

    // isValidHeadingLevel helper
    assert.equal(isValidHeadingLevel(1), true);
    assert.equal(isValidHeadingLevel(2), true);
    assert.equal(isValidHeadingLevel(3), true);
    assert.equal(isValidHeadingLevel(false), true);
    assert.equal(isValidHeadingLevel('1'), true);
    assert.equal(isValidHeadingLevel('normal'), true);
    assert.equal(isValidHeadingLevel(4), false);
    assert.equal(isValidHeadingLevel('h4'), false);
    assert.equal(isValidHeadingLevel(null), false);
  });
});

describe('Editor Core - Formatting Toggles & State Management', () => {
  test('format toggles list contains bold, italic, underline, strike', () => {
    assert.deepEqual(FORMAT_TOGGLES, ['bold', 'italic', 'underline', 'strike']);
  });

  test('toggles formatting attributes on and off immutably', () => {
    const initial = {};

    // Toggle bold on
    const withBold = toggleFormatState(initial, 'bold');
    assert.deepEqual(withBold, { bold: true });
    assert.deepEqual(initial, {}, 'Original object must not be mutated');

    // Toggle italic on
    const withItalic = toggleFormatState(withBold, 'italic');
    assert.deepEqual(withItalic, { bold: true, italic: true });

    // Toggle underline on
    const withUnderline = toggleFormatState(withItalic, 'underline');
    assert.deepEqual(withUnderline, { bold: true, italic: true, underline: true });

    // Toggle strike on
    const withStrike = toggleFormatState(withUnderline, 'strike');
    assert.deepEqual(withStrike, { bold: true, italic: true, underline: true, strike: true });

    // Toggle bold off
    const withoutBold = toggleFormatState(withStrike, 'bold');
    assert.deepEqual(withoutBold, { italic: true, underline: true, strike: true });
    assert.equal(withoutBold.bold, undefined);

    // Toggle italic off
    const withoutItalic = toggleFormatState(withoutBold, 'italic');
    assert.deepEqual(withoutItalic, { underline: true, strike: true });

    // Toggle remaining off
    const withoutUnderline = toggleFormatState(withoutItalic, 'underline');
    const clean = toggleFormatState(withoutUnderline, 'strike');
    assert.deepEqual(clean, {});
  });
});

describe('Editor Core - Format Painter State Machine', () => {
  let painter;

  beforeEach(() => {
    painter = new FormatPainter();
  });

  test('initial state is inactive with no stored formatting', () => {
    assert.equal(painter.hasFormat(), false);
    assert.equal(painter.active, false);
    assert.equal(painter.storedFormat, null);
    assert.equal(painter.getFormat(), null);
  });

  test('copies format from source selection and activates painter', () => {
    const sourceFormat = {
      bold: true,
      italic: true,
      font: 'Merriweather',
      size: '18px',
      color: '#0b57d0'
    };

    const copied = painter.copyFormat(sourceFormat);
    assert.deepEqual(copied, sourceFormat);
    assert.equal(painter.hasFormat(), true);
    assert.equal(painter.active, true);
    assert.deepEqual(painter.getFormat(), sourceFormat);

    // Verify defensive copy
    sourceFormat.bold = false;
    assert.equal(painter.getFormat().bold, true);
  });

  test('applies copied format to target and clears state (one-shot application)', () => {
    painter.copyFormat({
      bold: true,
      font: 'Fira Code',
      size: '14px'
    });

    const targetFormats = {
      italic: true,
      color: '#333333'
    };

    const result = painter.applyFormat(targetFormats);

    assert.deepEqual(result, {
      italic: true,
      color: '#333333',
      bold: true,
      font: 'Fira Code',
      size: '14px'
    });

    // Painter state is cleared after application
    assert.equal(painter.hasFormat(), false);
    assert.equal(painter.active, false);
    assert.equal(painter.storedFormat, null);
  });

  test('applyFormat without active copied format returns target formats unmodified', () => {
    const target = { bold: true, size: '12px' };
    const result = painter.applyFormat(target);
    assert.deepEqual(result, target);
  });

  test('clear() resets active state and stored format', () => {
    painter.copyFormat({ underline: true });
    assert.equal(painter.hasFormat(), true);

    painter.clear();
    assert.equal(painter.hasFormat(), false);
    assert.equal(painter.storedFormat, null);
    assert.equal(painter.active, false);
  });

  test('copying null or invalid format safely resets state', () => {
    painter.copyFormat({ bold: true });
    assert.equal(painter.hasFormat(), true);

    const res = painter.copyFormat(null);
    assert.equal(res, null);
    assert.equal(painter.hasFormat(), false);
  });
});

describe('Editor Core - Custom Table HTML Generator', () => {
  test('generates default 3x3 table with correct rows, cols, and wrapper', () => {
    const html = generateTableHTML();

    assert.ok(html.startsWith('<table style="width:100%;border-collapse:collapse;margin:12px 0;"><tbody>'));
    assert.ok(html.endsWith('</tbody></table><p><br></p>'));

    // Count <tr> occurrences
    const rowMatches = html.match(/<tr>/g);
    assert.equal(rowMatches ? rowMatches.length : 0, 3);

    // Count <td> occurrences (3 * 3 = 9)
    const colMatches = html.match(/<td /g);
    assert.equal(colMatches ? colMatches.length : 0, 9);
    assert.ok(html.includes('&nbsp;</td>'));
  });

  test('generates custom grid sizes (e.g. 5 rows x 4 cols, 2x6, 1x1)', () => {
    const html5x4 = generateTableHTML(5, 4);
    const rows5 = html5x4.match(/<tr>/g);
    const cols20 = html5x4.match(/<td /g);
    assert.equal(rows5.length, 5);
    assert.equal(cols20.length, 20);

    const html1x1 = generateTableHTML(1, 1);
    assert.equal((html1x1.match(/<tr>/g) || []).length, 1);
    assert.equal((html1x1.match(/<td /g) || []).length, 1);
  });

  test('clamps invalid or non-positive grid dimensions to at least 1x1', () => {
    const htmlClamped = generateTableHTML(0, -3);
    assert.equal((htmlClamped.match(/<tr>/g) || []).length, 1);
    assert.equal((htmlClamped.match(/<td /g) || []).length, 1);

    const htmlNaN = generateTableHTML('invalid', 'dimensions');
    assert.equal((htmlNaN.match(/<tr>/g) || []).length, 1);
    assert.equal((htmlNaN.match(/<td /g) || []).length, 1);
  });

  test('applies custom styling options (padding, border color)', () => {
    const htmlCustom = generateTableHTML(2, 2, {
      cellPadding: '14px 20px',
      borderColor: '#0b57d0'
    });

    assert.ok(htmlCustom.includes('padding:14px 20px;'));
    assert.ok(htmlCustom.includes('border:1px solid #0b57d0;'));
  });
});

describe('Editor Core - Link and Image Insertion Wrappers', () => {
  test('createLinkHTML creates secure anchor tags with escaping', () => {
    const link = createLinkHTML('Google Cloud', 'https://cloud.google.com');
    assert.equal(link, '<a href="https://cloud.google.com" target="_blank" rel="noopener noreferrer">Google Cloud</a>');

    // Fallback text to URL when text is omitted
    const fallbackLink = createLinkHTML(null, 'https://example.com');
    assert.equal(fallbackLink, '<a href="https://example.com" target="_blank" rel="noopener noreferrer">https://example.com</a>');

    // Quotes escaping in URL
    const dangerousUrl = 'https://example.com/?query="test"';
    const escapedLink = createLinkHTML('Search', dangerousUrl);
    assert.ok(escapedLink.includes('href="https://example.com/?query=&quot;test&quot;"'));
    assert.ok(!escapedLink.includes('href="https://example.com/?query="test""'));
  });

  test('createImageHTML creates responsive image tags with attributes and escaping', () => {
    const img = createImageHTML('https://example.com/logo.png', 'Company Logo');
    assert.equal(
      img,
      '<img src="https://example.com/logo.png" alt="Company Logo" style="max-width:100%;border-radius:4px;cursor:pointer;" />'
    );

    // Empty alt text handling
    const defaultAltImg = createImageHTML('https://example.com/photo.jpg');
    assert.equal(
      defaultAltImg,
      '<img src="https://example.com/photo.jpg" alt="" style="max-width:100%;border-radius:4px;cursor:pointer;" />'
    );

    // Quotes escaping in src and alt
    const injectionImg = createImageHTML('pic" onerror="alert(1)', 'Alt "quote" test');
    assert.ok(injectionImg.includes('src="pic&quot; onerror=&quot;alert(1)"'));
    assert.ok(injectionImg.includes('alt="Alt &quot;quote&quot; test"'));
  });
});
