import { useCallback, useEffect, useMemo, useState } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';
import {
  addDays,
  formatManilaDay,
  formatManilaTime,
  formatMinutes,
  manilaDate,
  manilaDayStart,
  weekStart,
} from '@/lib/manilaTime';
import {
  faceAttendanceService,
  faceErrorMessage,
  type Employee,
  type KioskAction,
  type TimeRecord,
} from '@/services/faceAttendanceService';
import ManualPunchModal from './ManualPunchModal';
import {
  Avatar,
  Chips,
  EmptyState,
  ErrorBanner,
  Icon,
  input,
  LiveDot,
  LocationLink,
  MethodBadge,
  panel,
  rowAction,
  SearchInput,
  SectionHeader,
  smallPrimary,
  smallSecondary,
  StatCard,
} from './ui';

type Preset = 'today' | 'yesterday' | 'week' | 'last15' | 'month' | 'custom';

function presetRange(preset: Preset, today: string): { from: string; to: string } {
  switch (preset) {
    case 'yesterday':
      return { from: addDays(today, -1), to: addDays(today, -1) };
    case 'week':
      return { from: weekStart(today), to: today };
    case 'last15':
      return { from: addDays(today, -14), to: today };
    case 'month':
      return { from: `${today.slice(0, 8)}01`, to: today };
    default:
      return { from: today, to: today };
  }
}

const PRESETS: { id: Preset; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'week', label: 'This week' },
  { id: 'last15', label: 'Last 15 days' },
  { id: 'month', label: 'This month' },
  { id: 'custom', label: 'Custom' },
];

function downloadCsv(records: TimeRecord[], from: string, to: string) {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const header = [
    'Date', 'Name', 'Position', 'Time in', 'Time in via', 'Time in tablet', 'Time in location', 'Time in accuracy (m)',
    'Time out', 'Time out via', 'Time out tablet', 'Time out location', 'Time out accuracy (m)', 'Hours',
  ];
  const coords = (l: TimeRecord['timeInLocation']) => (l ? `${l.latitude},${l.longitude}` : '');
  const acc = (l: TimeRecord['timeInLocation']) => (l ? String(Math.round(l.accuracy)) : '');
  const rows = [...records]
    .sort((a, b) => a.name.localeCompare(b.name) || a.timeIn.localeCompare(b.timeIn))
    .map((r) => [
      manilaDate(new Date(r.timeIn)),
      r.name,
      r.position ?? '',
      formatManilaTime(r.timeIn),
      r.timeInMethod,
      r.timeInDevice ?? '',
      coords(r.timeInLocation),
      acc(r.timeInLocation),
      r.timeOut ? formatManilaTime(r.timeOut) : 'still in',
      r.timeOutMethod ?? '',
      r.timeOutDevice ?? '',
      coords(r.timeOutLocation),
      acc(r.timeOutLocation),
      r.minutes === null ? '' : (r.minutes / 60).toFixed(2),
    ]);
  const csv = [header, ...rows].map((row) => row.map((c) => esc(String(c))).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `attendance_${from}_to_${to}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function TimeRecordsPanel() {
  const today = manilaDate(new Date());
  const [preset, setPreset] = useState<Preset>('today');
  const [range, setRange] = useState(() => presetRange('today', today));
  const [records, setRecords] = useState<TimeRecord[] | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [punch, setPunch] = useState<{ action: KioskAction; employee?: Employee } | null>(null);
  // Re-render each minute so "in for 3h 12m" stays current.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const load = useCallback(async () => {
    try {
      const [r, e] = await Promise.all([
        faceAttendanceService.listRecords(manilaDayStart(range.from), manilaDayStart(addDays(range.to, 1))),
        faceAttendanceService.listEmployees(),
      ]);
      setRecords(r.records);
      setEmployees(e.employees.filter((x) => x.active));
      setError(null);
    } catch (err) {
      setError(faceErrorMessage(err));
    }
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  const choosePreset = (p: Preset) => {
    setPreset(p);
    if (p !== 'custom') setRange(presetRange(p, today));
  };

  const inNow = employees
    .filter((e) => e.openSince)
    .sort((a, b) => a.openSince!.localeCompare(b.openSince!));
  const notIn = employees.filter((e) => !e.openSince);

  const q = search.trim().toLowerCase();
  const shown = useMemo(() => (records ?? []).filter((r) => !q || r.name.toLowerCase().includes(q)), [records, q]);

  // Per-person totals for the range (payroll summary). Open shifts are not counted.
  const totals = useMemo(() => {
    const byPerson = new Map<string, { id: string; name: string; minutes: number; days: Set<string>; open: number }>();
    for (const r of shown) {
      const t = byPerson.get(r.employeeId) ?? { id: r.employeeId, name: r.name, minutes: 0, days: new Set<string>(), open: 0 };
      if (r.minutes === null) t.open++;
      else t.minutes += r.minutes;
      t.days.add(manilaDate(new Date(r.timeIn)));
      byPerson.set(r.employeeId, t);
    }
    return [...byPerson.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [shown]);

  const totalMinutes = totals.reduce((sum, t) => sum + t.minutes, 0);
  const dayLabel = (date: string) => formatManilaDay(manilaDayStart(date).toISOString());
  const rangeLabel = range.from === range.to ? dayLabel(range.from) : `${dayLabel(range.from)} – ${dayLabel(range.to)}`;

  return (
    <div className='space-y-5'>
      {error && <ErrorBanner message={error} onRetry={load} />}

      <div className='grid grid-cols-2 lg:grid-cols-4 gap-3'>
        <StatCard icon={<Icon.LogIn className='w-4.5 h-4.5' />} label='In now' value={inNow.length} hint={`of ${employees.length} active staff`} />
        <StatCard icon={<Icon.Users className='w-4.5 h-4.5' />} label='People in range' value={records ? totals.length : '–'} hint={rangeLabel} />
        <StatCard icon={<Icon.Calendar className='w-4.5 h-4.5' />} label='Shifts' value={records ? shown.length : '–'} hint={rangeLabel} />
        <StatCard
          icon={<Icon.Clock className='w-4.5 h-4.5' />}
          label='Hours worked'
          value={records ? formatMinutes(totalMinutes) : '–'}
          hint='Closed shifts only'
        />
      </div>

      <section className={panel}>
        <SectionHeader
          title={
            <span className='inline-flex items-center gap-2'>
              {inNow.length > 0 && <LiveDot />}
              In now
              <span className='text-secondary/40 font-normal tabular-nums'>{inNow.length}</span>
            </span>
          }
          description='Live status from the kiosks. Fix a missed punch with a manual entry.'
          actions={
            <button disabled={notIn.length === 0} onClick={() => setPunch({ action: 'time_in' })} className={smallPrimary}>
              <Icon.LogIn />
              Manual time in
            </button>
          }
        />
        {inNow.length === 0 ? (
          <div className='border-t border-secondary/10'>
            <EmptyState icon={<Icon.Clock className='w-5 h-5' />} title='Nobody is timed in' />
          </div>
        ) : (
          <ul className='grid sm:grid-cols-2 xl:grid-cols-3 gap-px bg-secondary/10 border-t border-secondary/10 rounded-b-xl overflow-hidden'>
            {inNow.map((e) => (
              <li key={e.id} className='flex items-center gap-3 px-5 py-3 bg-white'>
                <Avatar name={e.name} />
                <div className='min-w-0 flex-1'>
                  <div className='font-semibold text-secondary truncate'>{e.name}</div>
                  <div className='text-3 text-secondary/50'>
                    Since {formatManilaTime(e.openSince!)}
                    {manilaDate(new Date(e.openSince!)) !== today && `, ${formatManilaDay(e.openSince!)}`}
                    <span className='text-success font-semibold'> · {formatMinutes(Math.max(0, Math.floor((now - Date.parse(e.openSince!)) / 60_000)))}</span>
                  </div>
                </div>
                <button onClick={() => setPunch({ action: 'time_out', employee: e })} className={rowAction} title={`Time ${e.name} out`}>
                  <Icon.LogOut className='w-3.5 h-3.5' />
                  Time out
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={panel}>
        <SectionHeader
          title='Time records'
          description={rangeLabel}
          actions={
            <button disabled={!shown.length} onClick={() => downloadCsv(shown, range.from, range.to)} className={smallSecondary}>
              <Icon.Download />
              Download CSV
            </button>
          }
        />
        <div className='flex flex-col lg:flex-row lg:items-center justify-between gap-3 px-5 pb-4'>
          <Chips<Preset> value={preset} onChange={choosePreset} options={PRESETS} />
          <SearchInput value={search} onChange={setSearch} placeholder='Filter by name' />
        </div>
        {preset === 'custom' && (
          <div className='flex flex-col sm:flex-row gap-3 px-5 pb-4'>
            <label className='flex-1 text-3 font-semibold text-secondary'>
              From
              <input type='date' className={`${input} mt-1`} value={range.from} max={range.to} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
            </label>
            <label className='flex-1 text-3 font-semibold text-secondary'>
              To
              <input type='date' className={`${input} mt-1`} value={range.to} min={range.from} max={today} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
            </label>
          </div>
        )}

        {!records ? (
          !error && (
            <div className='flex items-center justify-center py-16 border-t border-secondary/10'>
              <LoadingSpinner size='md' />
            </div>
          )
        ) : shown.length === 0 ? (
          <div className='border-t border-secondary/10'>
            {q ? (
              <EmptyState icon={<Icon.Search className='w-5 h-5' />} title='No matches'>
                No records for “{search.trim()}” in this range.
              </EmptyState>
            ) : (
              <EmptyState icon={<Icon.Calendar className='w-5 h-5' />} title='No time records'>
                Nobody timed in during this range. Try a wider range.
              </EmptyState>
            )}
          </div>
        ) : (
          <>
            {(totals.length > 1 || range.from !== range.to) && (
              <div className='px-5 pb-5'>
                <h4 className='text-2.5 font-bold text-secondary/50 uppercase tracking-wider mb-2'>Totals per person</h4>
                <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2'>
                  {totals.map((t) => (
                    <div key={t.id} className='flex items-center gap-3 rounded-lg bg-background border border-secondary/5 px-3 py-2.5'>
                      <Avatar name={t.name} />
                      <div className='min-w-0'>
                        <div className='font-semibold text-secondary truncate text-3.5'>{t.name}</div>
                        <div className='text-3 text-secondary/60'>
                          <span className='font-semibold text-secondary tabular-nums'>{formatMinutes(t.minutes)}</span> · {t.days.size} day
                          {t.days.size === 1 ? '' : 's'}
                          {t.open > 0 && <span className='text-success'> · open shift</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className='overflow-x-auto border-t border-secondary/10'>
              <table className='w-full text-3.5'>
                <thead className='bg-secondary/3'>
                  <tr className='text-left text-2.5 uppercase tracking-wider text-secondary/50'>
                    <th className='py-2.5 pl-5 pr-4 font-semibold'>Date</th>
                    <th className='py-2.5 pr-4 font-semibold'>Name</th>
                    <th className='py-2.5 pr-4 font-semibold'>Time in</th>
                    <th className='py-2.5 pr-4 font-semibold'>Time out</th>
                    <th className='py-2.5 pr-4 font-semibold'>Tablet</th>
                    <th className='py-2.5 pr-5 font-semibold text-right'>Hours</th>
                  </tr>
                </thead>
                <tbody className='divide-y divide-secondary/10'>
                  {shown.map((r) => {
                    const tablets = [...new Set([r.timeInDevice, r.timeOutDevice].filter(Boolean))] as string[];
                    return (
                      <tr key={r.id} className='text-secondary hover:bg-secondary/2'>
                        <td className='py-2.5 pl-5 pr-4 whitespace-nowrap text-secondary/70'>{formatManilaDay(r.timeIn)}</td>
                        <td className='py-2.5 pr-4 font-medium whitespace-nowrap'>{r.name}</td>
                        <td className='py-2.5 pr-4 whitespace-nowrap'>
                          <span className='inline-flex items-center gap-1.5'>
                            <span className='tabular-nums'>{formatManilaTime(r.timeIn)}</span>
                            <MethodBadge method={r.timeInMethod} />
                            <LocationLink location={r.timeInLocation} />
                          </span>
                        </td>
                        <td className='py-2.5 pr-4 whitespace-nowrap'>
                          {r.timeOut ? (
                            <span className='inline-flex items-center gap-1.5'>
                              <span className='tabular-nums'>{formatManilaTime(r.timeOut)}</span>
                              <MethodBadge method={r.timeOutMethod} />
                              <LocationLink location={r.timeOutLocation} />
                            </span>
                          ) : (
                            <span className='inline-flex items-center gap-1.5 text-success font-semibold'>
                              <LiveDot />
                              Still in
                            </span>
                          )}
                        </td>
                        <td className='py-2.5 pr-4 text-3 text-secondary/60 whitespace-nowrap'>
                          {tablets.length === 0 ? (
                            <span className='text-secondary/30'>Manual</span>
                          ) : (
                            <span className='inline-flex items-center gap-1'>
                              {tablets.map((t, i) => (
                                <span key={t} className='inline-flex items-center gap-1'>
                                  {i > 0 && <Icon.ArrowRight className='w-3 h-3 text-secondary/30' />}
                                  {t}
                                </span>
                              ))}
                            </span>
                          )}
                        </td>
                        <td className='py-2.5 pr-5 text-right tabular-nums font-semibold'>
                          {r.minutes === null ? <span className='text-secondary/30 font-normal'>Open</span> : formatMinutes(r.minutes)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {punch && (
        <ManualPunchModal action={punch.action} employee={punch.employee} choices={notIn} onClose={() => setPunch(null)} onDone={load} />
      )}
    </div>
  );
}
