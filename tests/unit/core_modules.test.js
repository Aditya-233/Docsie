import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  DocumentStore,
  MemoryStorage,
  generateDocId,
  generateVersionId,
  createDefaultDocument
} from '../../src/storage/documentStore.js';

import {
  extractHeadings,
  buildHeadingTree,
  extractOutline,
  calculateStats,
  slugifyHeading
} from '../../src/outline/outlineExtractor.js';

import {
  DocumentExporter,
  htmlToMarkdown,
  generateStandaloneHTML,
  htmlToPlainText,
  generateWordHtml
} from '../../src/export/exporter.js';

import {
  FindReplaceEngine,
  findMatches,
  replaceInText,
  replaceAllInText,
  escapeRegex
} from '../../src/tools/findReplace.js';

import {
  RulerManager,
  inchesToPx,
  pxToInches,
  mmToPx,
  pxToMm,
  ptToPx,
  pxToPt,
  clampMargin,
  calculateDragConstraints,
  PAGE_PRESETS,
  MARGIN_PRESETS
} from '../../src/tools/ruler.js';

import {
  ThemeManager,
  THEMES,
  PAGE_COLOR_PALETTE
} from '../../src/ui/theme.js';

describe('DocumentStore & Persistence', () => {
  test('creates, saves, retrieves, lists and deletes documents', () => {
    const memory = new MemoryStorage();
    const store = new DocumentStore(memory);

    const doc = store.createDocument({ title: 'My Architecture Spec' });
    assert.ok(doc.id.startsWith('doc_'));
    assert.equal(doc.title, 'My Architecture Spec');

    const retrieved = store.getDocument(doc.id);
    assert.deepEqual(retrieved.id, doc.id);
    assert.equal(retrieved.title, 'My Architecture Spec');

    doc.content = '<p>Updated content</p>';
    store.saveDocument(doc);
    const updated = store.getDocument(doc.id);
    assert.equal(updated.content, '<p>Updated content</p>');

    const list = store.listDocuments();
    assert.equal(list.length, 1);
    assert.equal(list[0].id, doc.id);

    store.deleteDocument(doc.id);
    assert.equal(store.getDocument(doc.id), null);
    assert.equal(store.listDocuments().length, 0);
  });

  test('version history snapshot creation, listing and restore', () => {
    const store = new DocumentStore(new MemoryStorage());
    const doc = store.createDocument({ title: 'Versioned Doc', content: '<p>Initial draft</p>' });

    const snap1 = store.createSnapshot(doc.id, { label: 'Draft 1' });
    assert.ok(snap1.id.startsWith('ver_'));
    assert.equal(snap1.label, 'Draft 1');

    doc.content = '<p>Second revision</p>';
    store.saveDocument(doc);
    const snap2 = store.createSnapshot(doc.id, { label: 'Draft 2' });

    const versions = store.listSnapshots(doc.id);
    assert.equal(versions.length, 2);
    assert.equal(versions[0].id, snap2.id);

    // Restore snap1
    const restored = store.restoreSnapshot(doc.id, snap1.id);
    assert.equal(restored.content, '<p>Initial draft</p>');
  });

  test('user profile management and randomization', () => {
    const store = new DocumentStore(new MemoryStorage());
    const profile = store.getUserProfile();
    assert.ok(profile.id.startsWith('user_'));
    assert.ok(profile.name.startsWith('Anonymous '));
    assert.ok(profile.color);

    profile.name = 'Alice Engineer';
    store.saveUserProfile(profile);
    const updatedProfile = store.getUserProfile();
    assert.equal(updatedProfile.name, 'Alice Engineer');
  });
});

describe('OutlineExtractor & Live Statistics', () => {
  const htmlContent = `
    <h1>Introduction</h1>
    <p>This is the introduction paragraph with some informative text.</p>
    <h2>Architecture Overview</h2>
    <p>Detailed architecture breakdown.</p>
    <h3>Frontend Layer</h3>
    <p>Quill and DOM architecture.</p>
    <h3>Backend Layer</h3>
    <p>BroadcastChannel and Sync protocols.</p>
    <h2>Conclusion</h2>
    <p>Wrap up notes.</p>
  `;

  test('extracts headings and generates unique slug anchor IDs', () => {
    const headings = extractHeadings(htmlContent);
    assert.equal(headings.length, 5);
    assert.equal(headings[0].text, 'Introduction');
    assert.equal(headings[0].level, 1);
    assert.equal(headings[1].text, 'Architecture Overview');
    assert.equal(headings[1].level, 2);
    assert.equal(headings[2].text, 'Frontend Layer');
    assert.equal(headings[2].level, 3);
  });

  test('builds hierarchical heading tree', () => {
    const { tree, count } = extractOutline(htmlContent);
    assert.equal(count, 5);
    assert.equal(tree.length, 1); // 1 root H1
    assert.equal(tree[0].children.length, 2); // 2 H2 children
    assert.equal(tree[0].children[0].children.length, 2); // 2 H3 children under first H2
  });

  test('calculates live statistics accurately', () => {
    const stats = calculateStats(htmlContent);
    assert.ok(stats.words > 15);
    assert.ok(stats.characters > 100);
    assert.ok(stats.charactersNoSpaces > 80);
    assert.ok(stats.paragraphs >= 5);
    assert.ok(stats.readingTimeMinutes >= 1);
  });
});

describe('Document Exporter Suite', () => {
  test('exports markdown with formatting, headings, lists and tables', () => {
    const html = `
      <h1>Main Title</h1>
      <p>This is <strong>bold</strong> and <em>italic</em> and <code>inline code</code>.</p>
      <blockquote>A famous quote</blockquote>
      <ul>
        <li>Item 1</li>
        <li>Item 2</li>
      </ul>
      <table>
        <tr><th>Header A</th><th>Header B</th></tr>
        <tr><td>Data 1</td><td>Data 2</td></tr>
      </table>
    `;

    const md = htmlToMarkdown(html);
    assert.ok(md.includes('# Main Title'));
    assert.ok(md.includes('**bold**'));
    assert.ok(md.includes('*italic*'));
    assert.ok(md.includes('`inline code`'));
    assert.ok(md.includes('> A famous quote'));
    assert.ok(md.includes('- Item 1'));
    assert.ok(md.includes('| Header A | Header B |'));
    assert.ok(md.includes('| Data 1 | Data 2 |'));
  });

  test('exports standalone HTML with CSS and print styles', () => {
    const standalone = generateStandaloneHTML('My Document', '<p>Hello world</p>');
    assert.ok(standalone.startsWith('<!DOCTYPE html>'));
    assert.ok(standalone.includes('<title>My Document</title>'));
    assert.ok(standalone.includes('<style>'));
    assert.ok(standalone.includes('@media print'));
    assert.ok(standalone.includes('<div class="doc-page-container">'));
  });

  test('exports plain text and Word HTML format', () => {
    const html = '<h1>Heading</h1><p>Line 1</p><p>Line 2 &amp; special</p>';
    const plain = htmlToPlainText(html);
    assert.ok(plain.includes('Heading'));
    assert.ok(plain.includes('Line 1'));
    assert.ok(plain.includes('Line 2 & special'));
    assert.ok(!plain.includes('<p>'));

    const wordHtml = generateWordHtml('Doc', html);
    assert.ok(wordHtml.includes('xmlns:w="urn:schemas-microsoft-com:office:word"'));
  });
});

describe('Find and Replace Engine', () => {
  test('finds occurrences with exact positions, line and column numbers', () => {
    const text = 'Alpha Beta Gamma\nAlpha Delta Epsilon\nZeta Alpha';
    const matches = findMatches(text, 'Alpha');
    assert.equal(matches.length, 3);
    assert.deepEqual(matches[0], { index: 0, length: 5, text: 'Alpha', line: 1, column: 1 });
    assert.deepEqual(matches[1], { index: 17, length: 5, text: 'Alpha', line: 2, column: 1 });
    assert.deepEqual(matches[2], { index: 42, length: 5, text: 'Alpha', line: 3, column: 6 });
  });

  test('respects case sensitive and whole word flags', () => {
    const text = 'cat Catch Caterpillar Cat';
    assert.equal(findMatches(text, 'cat', { caseSensitive: true }).length, 1);
    assert.equal(findMatches(text, 'cat', { caseSensitive: false }).length, 4);
    assert.equal(findMatches(text, 'cat', { wholeWord: true, caseSensitive: false }).length, 2);
  });

  test('FindReplaceEngine cyclical navigation and replacements', () => {
    const engine = new FindReplaceEngine('foo bar foo baz foo');
    const matches = engine.search('foo');
    assert.equal(matches.length, 3);
    assert.equal(engine.getCount().display, '1 of 3');

    const next = engine.next();
    assert.equal(engine.getCount().display, '2 of 3');

    const prev = engine.previous();
    assert.equal(engine.getCount().display, '1 of 3');

    // Replace all
    const { newText, count } = engine.replaceAll('qux');
    assert.equal(count, 3);
    assert.equal(newText, 'qux bar qux baz qux');
  });
});

describe('Ruler & Margins Engine', () => {
  test('converts units accurately', () => {
    assert.equal(inchesToPx(1.0), 96);
    assert.equal(inchesToPx(0.5), 48);
    assert.equal(pxToInches(96), 1.0);
    assert.equal(ptToPx(72), 96);
    assert.equal(pxToPt(96), 72);
  });

  test('calculates boundary constraints during left and right drag', () => {
    const rulerRect = { left: 0, width: 816 };

    // Left drag within safe boundary
    const dragLeft = calculateDragConstraints({
      markerType: 'left',
      clientX: 96,
      rulerRect,
      currentLeft: 72,
      currentFirstLine: 72,
      currentRight: 72,
      minContentWidth: 96
    });
    assert.equal(dragLeft.leftMargin, 96);
    assert.equal(dragLeft.firstLineMarker, 96);

    // Left drag attempting to exceed maximum printable boundary
    const dragExcess = calculateDragConstraints({
      markerType: 'left',
      clientX: 800,
      rulerRect,
      currentLeft: 72,
      currentFirstLine: 72,
      currentRight: 72,
      minContentWidth: 96
    });
    assert.equal(dragExcess.leftMargin, 816 - 72 - 96); // Clamped to 648
  });

  test('RulerManager state and presets', () => {
    const manager = new RulerManager();
    manager.setMarginsInches({ top: 1, right: 1, bottom: 1, left: 1 });
    const inInches = manager.getMarginsInches();
    assert.equal(inInches.top, 1.0);
    assert.equal(inInches.left, 1.0);
  });
});

describe('Theme & Page Color Manager', () => {
  test('toggles theme and notifies listeners', () => {
    const themeMgr = new ThemeManager();
    let notifiedTheme = null;
    themeMgr.on('themeChange', (effective) => {
      notifiedTheme = effective;
    });

    themeMgr.setTheme(THEMES.DARK);
    assert.equal(themeMgr.getTheme(), THEMES.DARK);
    assert.equal(themeMgr.isDarkMode(), true);
    assert.equal(notifiedTheme, 'dark');

    themeMgr.toggleTheme();
    assert.equal(themeMgr.getTheme(), THEMES.LIGHT);
    assert.equal(themeMgr.isDarkMode(), false);
  });

  test('manages page color and palette', () => {
    const themeMgr = new ThemeManager();
    assert.ok(PAGE_COLOR_PALETTE.length >= 8);

    themeMgr.setPageColor('#fff9e6');
    assert.equal(themeMgr.getPageColor(), '#fff9e6');

    themeMgr.resetPageColor();
    assert.equal(themeMgr.getPageColor(), '#ffffff');
  });
});
