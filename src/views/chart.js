// Weekly check-in chart, drawn as inline SVG on the server (no chart library,
// no JavaScript needed).
//
// Design choices (from data-visualization best practice):
//   - one series, one color (no legend needed; the heading names it)
//   - thin columns (24px max) with rounded tops, square at the baseline
//   - light hairline gridlines at whole numbers, because check-ins are counts
//   - only the most recent week gets a value label; that's the number that matters
//   - every bar has a hover tooltip (<title>), and the SAME numbers are always
//     available as a real HTML table, so no one has to rely on the picture

import { html, raw, escapeHtml } from './html.js';
import { formatLocal } from '../tz.js';
import { t } from '../i18n/index.js'; // [v2 i18n]
import { tx } from './components.js';

const W = 420; // viewBox width
const H = 200; // viewBox height (includes the x-axis label band)
const PAD = { top: 26, right: 12, bottom: 38, left: 38 };
const BAR_MAX = 24;
const COLORS = { bar: '#256abf', barLatest: '#0d366b', grid: '#e4e1d8', axis: '#9c978b', text: '#3f3c36' };

const shortDate = (d) => formatLocal(d, { month: 'short', day: 'numeric' });
const weekRange = (w) => `${shortDate(w.start)}–${shortDate(w.end)}`;

// Column with a 4px rounded top and a square bottom, as an SVG path.
function columnPath(x, y, width, height) {
  const r = Math.min(4, height, width / 2);
  const bottom = y + height;
  return `M${x},${bottom} V${y + r} Q${x},${y} ${x + r},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${bottom} Z`;
}

export function weeklyChart(weeks, { idPrefix, name }) {
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const maxCount = Math.max(3, ...weeks.map((w) => w.count));
  const y = (v) => PAD.top + plotH - (v / maxCount) * plotH;
  const slot = plotW / weeks.length;
  const barW = Math.min(BAR_MAX, slot - 2); // never fill the slot; leftover is air

  let svg = '';
  // Gridlines + y tick labels (whole numbers only)
  const step = maxCount <= 4 ? 1 : Math.ceil(maxCount / 4);
  for (let v = 0; v <= maxCount; v += step) {
    const gy = y(v);
    svg += `<line x1="${PAD.left}" x2="${W - PAD.right}" y1="${gy}" y2="${gy}" stroke="${v === 0 ? COLORS.axis : COLORS.grid}" stroke-width="1"/>`;
    svg += `<text x="${PAD.left - 8}" y="${gy + 5}" text-anchor="end" font-size="16" fill="${COLORS.text}">${v}</text>`;
  }

  weeks.forEach((w, i) => {
    const cx = PAD.left + slot * i + slot / 2;
    const x = cx - barW / 2;
    const isLatest = i === weeks.length - 1;
    const tip = t(`core.chart.tip.${isLatest ? 'thisWeek' : 'week'}.${w.count === 1 ? 'one' : 'other'}`, { range: weekRange(w), n: w.count });
    svg += `<g><title>${escapeHtml(tip)}</title>`;
    // Invisible full-height hit area so the tooltip is easy to trigger.
    svg += `<rect x="${PAD.left + slot * i}" y="${PAD.top}" width="${slot}" height="${plotH}" fill="transparent"/>`;
    if (w.count > 0) {
      const top = y(w.count);
      svg += `<path d="${columnPath(x, top, barW, PAD.top + plotH - top)}" fill="${isLatest ? COLORS.barLatest : COLORS.bar}"/>`;
    }
    if (isLatest) {
      svg += `<text x="${cx}" y="${y(w.count) - 7}" text-anchor="middle" font-size="17" font-weight="700" fill="#111">${w.count}</text>`;
    }
    svg += '</g>';
  });

  // X-axis labels: oldest week, middle, and "This week" (8 dates would crowd).
  const labelAt = (i, text, anchor) =>
    `<text x="${PAD.left + slot * i + slot / 2}" y="${H - 10}" text-anchor="${anchor}" font-size="16" fill="${COLORS.text}">${escapeHtml(text)}</text>`;
  svg += labelAt(0, shortDate(weeks[0].start), 'start');
  svg += labelAt(Math.floor(weeks.length / 2), shortDate(weeks[Math.floor(weeks.length / 2)].start), 'middle');
  svg += labelAt(weeks.length - 1, t('core.chart.thisWeek'), 'end');

  const counts = weeks.map((w) => w.count);
  const summary = t('core.chart.summary', { name, weeks: weeks.length, counts: counts.join(', '), latest: counts[counts.length - 1] });

  return html`
    <figure class="chart">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="${idPrefix}-title" focusable="false">
        <title id="${idPrefix}-title">${summary}</title>
        ${raw(svg)}
      </svg>
      <figcaption class="chart-caption">${tx('core.chart.caption')}</figcaption>
      <details class="chart-table">
        <summary>${tx('core.chart.showTable')}</summary>
        <table>
          <caption class="visually-hidden">${tx('core.chart.tableCaption', { name })}</caption>
          <thead><tr><th scope="col">${tx('core.chart.week')}</th><th scope="col">${tx('core.chart.count')}</th></tr></thead>
          <tbody>
            ${[...weeks].reverse().map(
              (w, i) => html`<tr><th scope="row">${i === 0 ? t('core.chart.thisWeekRange', { range: weekRange(w) }) : weekRange(w)}</th><td>${w.count}</td></tr>`
            )}
          </tbody>
        </table>
      </details>
    </figure>`;
}
