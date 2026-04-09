/**
 * Extract a meaningful date from a filename or document content.
 * Returns an ISO date string (YYYY-MM-DD) or null.
 */

/**
 * Parse a date from a filename like:
 *   MeetingTranscript_Abacus_2026-01-21
 *   WeeklySync_2025-12-03.pdf
 *   Q1_Report_01-15-2026.docx
 *   call_notes_jan_21_2026.txt
 */
export function parseDateFromFilename(fileName) {
  if (!fileName) return null;

  // Strip extension
  const base = fileName.replace(/\.[^.]+$/, '');

  // Pattern 1: YYYY-MM-DD (ISO format, most common in your naming)
  const isoMatch = base.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const d = new Date(`${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}T00:00:00`);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }

  // Pattern 2: MM-DD-YYYY or MM/DD/YYYY
  const usMatch = base.match(/(\d{2})[-\/](\d{2})[-\/](\d{4})/);
  if (usMatch) {
    const d = new Date(`${usMatch[3]}-${usMatch[1]}-${usMatch[2]}T00:00:00`);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }

  // Pattern 3: DD-MM-YYYY (less common, skip to avoid ambiguity with Pattern 2)

  // Pattern 4: YYYYMMDD (compact)
  const compactMatch = base.match(/(\d{4})(\d{2})(\d{2})/);
  if (compactMatch) {
    const month = parseInt(compactMatch[2]);
    const day = parseInt(compactMatch[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const d = new Date(`${compactMatch[1]}-${compactMatch[2]}-${compactMatch[3]}T00:00:00`);
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    }
  }

  // Pattern 5: Month name patterns like "jan_21_2026", "January 21 2026"
  const months = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    january: '01', february: '02', march: '03', april: '04',
    june: '06', july: '07', august: '08', september: '09',
    october: '10', november: '11', december: '12'
  };
  const monthNames = Object.keys(months).join('|');
  const monthRegex = new RegExp(`(${monthNames})[_\\s-]*(\\d{1,2})[_\\s,-]*(\\d{4})`, 'i');
  const monthMatch = base.match(monthRegex);
  if (monthMatch) {
    const mm = months[monthMatch[1].toLowerCase()];
    const dd = monthMatch[2].padStart(2, '0');
    const yyyy = monthMatch[3];
    const d = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }

  return null;
}

/**
 * Resolve a user's natural language time reference to a date range.
 * Returns { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' } or null.
 *
 * Examples: "last week", "in January", "last month", "Q1 2026", "recently"
 */
export function resolveTimeReference(query) {
  const lower = query.toLowerCase();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed

  // "today"
  if (/\btoday\b/.test(lower)) {
    const d = now.toISOString().split('T')[0];
    return { start: d, end: d };
  }

  // "yesterday"
  if (/\byesterday\b/.test(lower)) {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    const ds = d.toISOString().split('T')[0];
    return { start: ds, end: ds };
  }

  // "this week"
  if (/\bthis week\b/.test(lower)) {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay()); // Sunday
    return { start: start.toISOString().split('T')[0], end: now.toISOString().split('T')[0] };
  }

  // "last week"
  if (/\blast week\b/.test(lower)) {
    const end = new Date(now);
    end.setDate(now.getDate() - now.getDay() - 1); // Last Saturday
    const start = new Date(end);
    start.setDate(end.getDate() - 6); // Last Sunday
    return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
  }

  // "this month"
  if (/\bthis month\b/.test(lower)) {
    const start = new Date(year, month, 1);
    return { start: start.toISOString().split('T')[0], end: now.toISOString().split('T')[0] };
  }

  // "last month"
  if (/\blast month\b/.test(lower)) {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0); // last day of prev month
    return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
  }

  // "recently" / "recent" — last 14 days
  if (/\brecent(ly)?\b/.test(lower)) {
    const start = new Date(now);
    start.setDate(now.getDate() - 14);
    return { start: start.toISOString().split('T')[0], end: now.toISOString().split('T')[0] };
  }

  // Quarter references: "Q1", "Q2 2026", etc.
  const qMatch = lower.match(/\bq([1-4])(?:\s*(\d{4}))?\b/);
  if (qMatch) {
    const q = parseInt(qMatch[1]);
    const qYear = qMatch[2] ? parseInt(qMatch[2]) : year;
    const startMonth = (q - 1) * 3;
    const start = new Date(qYear, startMonth, 1);
    const end = new Date(qYear, startMonth + 3, 0);
    return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
  }

  // Specific month name: "in January", "from March", "the February meeting"
  const months = {
    january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
    july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
    jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
  };
  for (const [name, idx] of Object.entries(months)) {
    const re = new RegExp(`\\b${name}(?:\\s+(\\d{4}))?\\b`, 'i');
    const mMatch = lower.match(re);
    if (mMatch) {
      const mYear = mMatch[1] ? parseInt(mMatch[1]) : year;
      const start = new Date(mYear, idx, 1);
      const end = new Date(mYear, idx + 1, 0);
      return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
    }
  }

  // Specific date in query: "the 2026-01-21 meeting"
  const isoInQuery = lower.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoInQuery) {
    const d = `${isoInQuery[1]}-${isoInQuery[2]}-${isoInQuery[3]}`;
    return { start: d, end: d };
  }

  return null;
}
