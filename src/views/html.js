// HTML helpers.
//
// `html` is a tagged template that ESCAPES every ${value} by default, so
// text typed into a form (like a name with <script> in it) shows up as text
// and is never run as code. This blocks cross-site scripting (XSS).
// Use raw() only for HTML that our own code built.

import { localParts, formatLocal } from '../tz.js';

class SafeHtml {
  constructor(value) {
    this.value = value;
  }
  toString() {
    return this.value;
  }
}

export const raw = (value) => new SafeHtml(String(value));

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function render(value) {
  if (value === null || value === undefined || value === false) return '';
  if (Array.isArray(value)) return value.map(render).join('');
  if (value instanceof SafeHtml) return value.value;
  return escapeHtml(value);
}

export function html(strings, ...values) {
  let out = strings[0];
  values.forEach((v, i) => {
    out += render(v) + strings[i + 1];
  });
  return new SafeHtml(out);
}

// ----- date formatting (always Carmel, Indiana time; see tz.js) -----

export function formatDate(iso) {
  return formatLocal(iso, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatLongDate(iso) {
  return formatLocal(iso, { weekday: 'long', month: 'long', day: 'numeric' });
}

export function formatTime(iso) {
  return formatLocal(iso, { hour: 'numeric', minute: '2-digit' });
}

export function formatDateTime(iso) {
  return `${formatLongDate(iso)} at ${formatTime(iso)}`;
}

export function daysAgoText(days) {
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

export function plural(n, word, pluralWord = `${word}s`) {
  return `${n} ${n === 1 ? word : pluralWord}`;
}

// YYYY-MM-DD and HH:MM in Carmel time, for <input type="date"> / <input type="time">
const pad = (n) => String(n).padStart(2, '0');

export function toDateInput(date) {
  const p = localParts(date);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function toTimeInput(date) {
  const p = localParts(date);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}
