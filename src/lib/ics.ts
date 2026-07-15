// Geração manual de .ics (RFC 5545), sem lib externa.

export interface IcsFixture {
  id: number;
  home: string;
  away: string;
  competition: string;
  round: string | null;
  venue: string | null;
  startsAt: Date;
  status: string;
  revision: number;
}

const EVENT_DURATION_MS = 2 * 60 * 60 * 1000; // 2h fixas

// Escapa caracteres especiais de valores de texto (RFC 5545 §3.3.11).
function esc(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

// Formata uma data em UTC no formato `YYYYMMDDTHHMMSSZ`.
function formatUtc(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

// Folding: nenhuma linha pode passar de 75 octetos. Quebra em CRLF + espaço,
// respeitando limites de octeto (não corta no meio de um caractere multibyte).
function foldLine(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;

  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let start = 0;
  // primeira linha: 75 octetos; continuações: 74 (o espaço inicial conta como 1).
  let limit = 75;
  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length);
    // não cortar no meio de um caractere UTF-8: recua enquanto for byte de continuação.
    if (end < bytes.length) {
      while (end > start && (bytes[end] & 0xc0) === 0x80) end--;
    }
    chunks.push(decoder.decode(bytes.subarray(start, end)));
    start = end;
    limit = 74;
  }
  return chunks.join('\r\n ');
}

function line(name: string, value: string): string {
  return foldLine(`${name}:${value}`);
}

function buildEvent(f: IcsFixture, dtstamp: string): string[] {
  const start = formatUtc(f.startsAt);
  const end = formatUtc(new Date(f.startsAt.getTime() + EVENT_DURATION_MS));
  const description =
    f.round != null ? `${f.competition} · ${f.round}` : f.competition;

  const rows = [
    'BEGIN:VEVENT',
    line('UID', `fixture-${f.id}@futcal`),
    line('SEQUENCE', String(f.revision)),
    line('DTSTAMP', dtstamp),
    line('DTSTART', start),
    line('DTEND', end),
    line('SUMMARY', esc(`${f.home} x ${f.away} — ${f.competition}`)),
    line('DESCRIPTION', esc(description)),
    line('STATUS', f.status === 'PST' ? 'TENTATIVE' : 'CONFIRMED'),
  ];
  if (f.venue != null) {
    rows.push(line('LOCATION', esc(f.venue)));
  }
  rows.push('END:VEVENT');
  return rows;
}

export function buildCalendar(opts: {
  calName: string;
  fixtures: IcsFixture[];
  now: Date;
}): string {
  const dtstamp = formatUtc(opts.now);

  const rows = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//futcal//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    line('X-WR-CALNAME', esc(opts.calName)),
    'REFRESH-INTERVAL;VALUE=DURATION:PT12H',
    'X-PUBLISHED-TTL:PT12H',
    ...opts.fixtures.flatMap((f) => buildEvent(f, dtstamp)),
    'END:VCALENDAR',
  ];

  return `${rows.join('\r\n')}\r\n`;
}
