// "Add to calendar": an RFC 5545 iCalendar file for one scheduled call.
//
// Times are exact UTC moments (DTSTART:20270115T210000Z), so every calendar
// app shows the call at the right local time, wherever the phone is. The
// moment itself was fixed in Carmel time when the call was scheduled (tz.js).
// The file never includes call notes or family contact details.

import { methodLabel } from '../vocab.js';
import { toDateInput } from '../views/html.js';
import { firstName } from './words.js';

export const DEFAULT_CALL_MINUTES = 30;

const pad = (n) => String(n).padStart(2, '0');

// 20270115T210000Z: an exact moment in UTC (not a calendar date).
export function icsUtc(date) {
  const d = new Date(date);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

// TEXT values: escape backslash, semicolon, comma, and newlines (RFC 5545 3.3.11).
export function escapeIcsText(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/[\u0000-\u001f\u007f]/g, ''); // other control characters aren't allowed
}

// Lines longer than 75 octets are folded: CRLF plus one space (RFC 5545 3.1).
// Never splits a multi-byte UTF-8 character.
export function foldLine(line) {
  const encoder = new TextEncoder();
  const out = [];
  let current = '';
  let bytes = 0;
  let limit = 75;
  for (const ch of line) {
    const size = encoder.encode(ch).length;
    if (bytes + size > limit) {
      out.push(current);
      current = '';
      bytes = 0;
      limit = 74; // the leading space of a continuation line counts
    }
    current += ch;
    bytes += size;
  }
  out.push(current);
  return out.join('\r\n ');
}

const slug = (s) =>
  String(s)
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30) || 'senior';

export function buildCallIcs({ contact, senior, volunteer, now }) {
  const name = firstName(senior);
  const start = new Date(contact.scheduledFor);
  const minutes = Number.isInteger(contact.durationMinutes) && contact.durationMinutes > 0 ? contact.durationMinutes : DEFAULT_CALL_MINUTES;
  const end = new Date(start.getTime() + minutes * 60 * 1000);
  const what = contact.type === 'visit' ? 'visit' : 'call';
  const description = `${methodLabel(contact.type)} with ${name}${volunteer ? ` and ${volunteer.name}` : ''}. Scheduled in PorchLight.`;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PorchLight//Calls and visits//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${escapeIcsText(contact.id)}@porchlight`,
    `DTSTAMP:${icsUtc(now)}`,
    `DTSTART:${icsUtc(start)}`,
    `DTEND:${icsUtc(end)}`,
    `SUMMARY:${escapeIcsText(`PorchLight ${what} with ${name}`)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return {
    body: `${lines.map(foldLine).join('\r\n')}\r\n`,
    filename: `porchlight-${what}-${slug(name)}-${toDateInput(start)}.ics`,
  };
}

// The app's `res` (src/http.js) only writes HTML, JSON, and redirects. To send
// a file, write the body with res.html() and then swap in the right headers
// when the handler turns `res` into a Response.
export function sendDownload(res, { body, contentType, filename }) {
  res.html(body);
  const toResponse = res.toResponse;
  res.toResponse = () => {
    const response = toResponse();
    const headers = new Headers(response.headers);
    headers.set('Content-Type', contentType);
    headers.set('Content-Disposition', `attachment; filename="${filename}"`);
    return new Response(response.body, { status: response.status, headers });
  };
}
