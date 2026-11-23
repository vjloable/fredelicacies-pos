// Kiosk times are always shown in branch-local time, whatever the tablet's clock zone.
const TZ = 'Asia/Manila';

const timeFmt = new Intl.DateTimeFormat('en-PH', { timeZone: TZ, hour: 'numeric', minute: '2-digit' });
const dayFmt = new Intl.DateTimeFormat('en-PH', { timeZone: TZ, month: 'short', day: 'numeric' });
const dateKey = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

export const formatTime = (iso: string) => timeFmt.format(new Date(iso));

const isToday = (iso: string, now: Date) => dateKey.format(new Date(iso)) === dateKey.format(now);

/** "5:10 PM" for today, "Nov 20, 5:10 PM" for older punches. */
export const formatWhen = (iso: string, now: Date) =>
  isToday(iso, now) ? formatTime(iso) : `${dayFmt.format(new Date(iso))}, ${formatTime(iso)}`;

export const formatHeaderDate = (now: Date) =>
  new Intl.DateTimeFormat('en-PH', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric' }).format(now);
