// Color contrast for every theme the Accessibility menu offers, computed from
// the tokens in public/styles.css (WCAG 2 relative luminance):
//   - body text: at least 7:1 (AAA)
//   - lines that mark a control, chart bars, and focus: at least 4.5:1
// Themes: light (default), dark, high contrast, and high contrast + dark.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT_DIR } from '../../src/config.js';

const css = fs.readFileSync(path.join(ROOT_DIR, 'public', 'styles.css'), 'utf8');

// The declarations inside the first `selector {` block after `from`.
function block(selector, from = 0) {
  const start = css.indexOf(`${selector} {`, from);
  assert.ok(start >= 0, `styles.css has a "${selector}" block`);
  const open = css.indexOf('{', start);
  return { text: css.slice(open + 1, css.indexOf('}', open)), end: css.indexOf('}', open) };
}
function tokens(text) {
  const out = {};
  for (const m of text.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

const light = tokens(block(':root').text);
const autoDark = block('html:not(.theme-light)', css.indexOf('@media screen and (prefers-color-scheme: dark)'));
const pickedDark = block('html.theme-dark');
const high = tokens(block('html.contrast-high').text);
const dark = tokens(pickedDark.text);

const THEMES = {
  light: { ...light },
  dark: { ...light, ...dark },
  'high contrast': { ...light, ...high },
  'high contrast + dark': { ...light, ...dark, ...high },
};

function resolve(theme, name, seen = new Set()) {
  const value = theme[name];
  assert.ok(value, `token ${name} is defined`);
  const ref = value.match(/^var\((--[\w-]+)\)$/);
  if (!ref) return value;
  assert.ok(!seen.has(name), `token ${name} does not loop`);
  return resolve(theme, ref[1], new Set([...seen, name]));
}

function luminance(hex) {
  const m = hex.match(/^#([0-9a-f]{6})$/i);
  assert.ok(m, `${hex} is a 6-digit hex color`);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a, b) {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

const SURFACES = ['--bg', '--surface', '--surface-2'];
const TEXT_PAIRS = [
  // ordinary text and links, on every page surface
  ...['--text', '--text-2', '--muted', '--link', '--link-visited', '--accent-text',
    '--risk-text', '--soon-text', '--match-text', '--ok-text', '--drop-text', '--info-text']
    .flatMap((fg) => SURFACES.map((bg) => [fg, bg])),
  // status badges, tiles, banners, and the error summary
  ['--risk-text', '--risk-bg'], ['--soon-text', '--soon-bg'], ['--match-text', '--match-bg'],
  ['--ok-text', '--ok-bg'], ['--drop-text', '--drop-bg'], ['--info-text', '--info-bg'],
  ['--neutral-text', '--neutral-bg'], ['--chip-text', '--chip-bg'],
  // tinted panels
  ['--text', '--notice-bg'], ['--soon-text', '--notice-bg'], ['--text', '--welcome-bg'],
  ['--text', '--spark-bg'], ['--muted', '--spark-bg'], ['--text', '--tip-bg'], ['--muted', '--tip-bg'],
  // form fields
  ['--text', '--field-bg'], ['--muted', '--field-bg'],
  // buttons: rest, hover, and press
  ['--on-primary', '--primary'], ['--on-primary', '--primary-hover'], ['--on-primary', '--primary-press'],
  ['--primary', '--secondary-bg'], ['--primary-hover', '--secondary-hover'], ['--primary-press', '--secondary-press'],
  ['--on-danger', '--danger'], ['--on-danger', '--danger-hover'], ['--on-danger', '--danger-press'],
  ['--pressed-text', '--pressed-bg'], ['--text', '--secondary-bg'], ['--text', '--secondary-hover'], ['--text', '--secondary-press'],
  // header, navigation, and the menu button
  ['--header-text', '--header-bg'], ['--header-text', '--nav-bg'], ['--header-text', '--header-hover'],
  ['--header-text', '--header-press'], ['--brand', '--header-bg'], ['--header-bg', '--header-text'],
  // chart labels
  ['--chart-text', '--surface'], ['--chart-label', '--surface'],
];
const LINE_PAIRS = [
  ['--field-border', '--field-bg'], ['--field-border', '--surface'], ['--field-border', '--bg'],
  ['--primary', '--surface'], ['--primary', '--bg'], ['--danger', '--surface'],
  ['--chart-bar', '--surface'], ['--chart-bar-latest', '--surface'],
  ['--header-control', '--header-bg'], ['--focus-ring', '--focus'],
];

for (const [name, theme] of Object.entries(THEMES)) {
  test(`${name}: text reaches 7:1 and control lines 4.5:1`, () => {
    const failures = [];
    const check = ([fg, bg], min) => {
      const r = ratio(resolve(theme, fg), resolve(theme, bg));
      if (r < min) failures.push(`${fg} on ${bg}: ${r.toFixed(2)} < ${min}`);
    };
    TEXT_PAIRS.forEach((pair) => check(pair, 7));
    LINE_PAIRS.forEach((pair) => check(pair, 4.5));
    // The focus indicator is two-tone (dark ring + yellow halo): one of them must stand out.
    for (const bg of SURFACES) {
      const best = Math.max(ratio(resolve(theme, '--focus-ring'), resolve(theme, bg)), ratio(resolve(theme, '--focus'), resolve(theme, bg)));
      if (best < 4.5) failures.push(`focus ring on ${bg}: ${best.toFixed(2)} < 4.5`);
    }
    assert.deepEqual(failures, []);
  });
}

test('the two dark-theme blocks ("theme-dark" and "match my device" when the device is dark) are identical', () => {
  assert.equal(autoDark.text.trim().replace(/\s+/g, ' '), pickedDark.text.trim().replace(/\s+/g, ' '));
});

test('dark and high contrast are screen-only, so print stays black on white', () => {
  assert.match(css, /@media screen and \(prefers-color-scheme: dark\) \{\s*html:not\(\.theme-light\) \{/);
  const screen = css.indexOf('@media screen {\n  html.theme-dark {');
  assert.ok(screen >= 0, 'html.theme-dark sits inside @media screen');
  assert.ok(css.indexOf('html.contrast-high {') > screen, 'high contrast comes after the dark theme, inside @media screen');
  const print = css.slice(css.indexOf('@media print {'));
  assert.match(print, /body \{ background: #ffffff; color: #000000; \}/);
  assert.match(print, /:root \{ color-scheme: light; \}/);
});

test('no translucency or blur anywhere in the stylesheet', () => {
  assert.doesNotMatch(css, /backdrop-filter|filter:\s*blur/);
  // Alpha is allowed only inside shadows.
  for (const line of css.split('\n')) {
    if (/rgb\([^)]*\/\s*0?\.\d+\)|rgba\(|hsla\(/.test(line)) assert.match(line, /--shadow:/, line.trim());
  }
});
