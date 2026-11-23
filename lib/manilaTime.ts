// Date helpers pinned to branch-local time (Asia/Manila, UTC+8, no DST), so
// reports and manual entries mean the same thing on any device clock.
const TZ = 'Asia/Manila';
const OFFSET = '+08:00';

const partsFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function parts(d: Date) {
  const p = Object.fromEntries(partsFmt.formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

/** 'YYYY-MM-DD' of the Manila calendar day containing `d`. */
export const manilaDate = (d: Date): string => parts(d).date;

/** Value for an <input type="datetime-local">, in Manila time. */
export const toManilaInput = (d: Date): string => {
  const p = parts(d);
  return `${p.date}T${p.time}`;
};

/** Parse an <input type="datetime-local"> value as Manila time. */
export const fromManilaInput = (value: string): Date => new Date(`${value}:00${OFFSET}`);

/** Start of a Manila calendar day given as 'YYYY-MM-DD'. */
export const manilaDayStart = (date: string): Date => new Date(`${date}T00:00:00${OFFSET}`);

/** Add whole days to a 'YYYY-MM-DD' date. */
export const addDays = (date: string, days: number): string => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** Monday of the week containing a 'YYYY-MM-DD' date. */
export const weekStart = (date: string): string => {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(date, -((dow + 6) % 7));
};

const timeFmt = new Intl.DateTimeFormat('en-PH', { timeZone: TZ, hour: 'numeric', minute: '2-digit' });
const dayFmt = new Intl.DateTimeFormat('en-PH', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric' });

export const formatManilaTime = (iso: string): string => timeFmt.format(new Date(iso));
export const formatManilaDay = (iso: string): string => dayFmt.format(new Date(iso));

/** 485 → "8h 05m". */
export const formatMinutes = (minutes: number): string =>
  `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
