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
import { input, MethodBadge, panel } from './ui';

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
  const header = ['Date', 'Name', 'Position', 'Time in', 'Time in via', 'Time out', 'Time out via', 'Hours'];
  const rows = [...records]
    .sort((a, b) => a.name.localeCompare(b.name) || a.timeIn.localeCompare(b.timeIn))
    .map((r) => [
      manilaDate(new Date(r.timeIn)),
      r.name,
      r.position ?? '',
      formatManilaTime(r.timeIn),
      r.timeInMethod,
      r.timeOut ? formatManilaTime(r.timeOut) : 'still in',
      r.timeOutMethod ?? '',
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

export default function TimeRecordsPanel({ branchId }: { branchId: string }) {
  const today = manilaDate(new Date());
  const [preset, setPreset] = useState<Preset>('today');
  const [range, setRange] = useState(() => presetRange('today', today));
  const [records, setRecords] = useState<TimeRecord[] | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [punch, setPunch] = useState<{ action: KioskAction; employee?: Employee } | null>(null);

  const load = useCallback(async () => {
    try {
      const [r, e] = await Promise.all([
        faceAttendanceService.listRecords(branchId, manilaDayStart(range.from), manilaDayStart(addDays(range.to, 1))),
        faceAttendanceService.listEmployees(branchId),
      ]);
      setRecords(r.records);
      setEmployees(e.employees.filter((x) => x.active));
      setError(null);
    } catch (err) {
      setError(faceErrorMessage(err));
    }
  }, [branchId, range]);

  useEffect(() => {
    load();
  }, [load]);

  const choosePreset = (p: Preset) => {
    setPreset(p);
    if (p !== 'custom') setRange(presetRange(p, today));
  };

  const inNow = employees.filter((e) => e.openSince);
  const notIn = employees.filter((e) => !e.openSince);

  // Per-person totals for the range (payroll summary). Open shifts are not counted.
  const totals = useMemo(() => {
    const byPerson = new Map<string, { id: string; name: string; minutes: number; days: Set<string>; open: number }>();
    for (const r of records ?? []) {
      const t = byPerson.get(r.employeeId) ?? { id: r.employeeId, name: r.name, minutes: 0, days: new Set<string>(), open: 0 };
      if (r.minutes === null) t.open++;
      else t.minutes += r.minutes;
      t.days.add(manilaDate(new Date(r.timeIn)));
      byPerson.set(r.employeeId, t);
    }
    return [...byPerson.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [records]);

  return (
    <div className='space-y-6'>
      {error && <p className='text-3.5 text-error'>{error}</p>}

      <section className={panel}>
        <div className='flex items-center justify-between gap-4 mb-4'>
          <h3 className='font-bold text-secondary'>
            In now <span className='text-secondary/50 font-normal'>({inNow.length})</span>
          </h3>
          <button
            disabled={notIn.length === 0}
            onClick={() => setPunch({ action: 'time_in' })}
            className='text-xs font-black text-primary bg-accent px-3 py-1.5 rounded-lg disabled:opacity-40'>
            + MANUAL TIME IN
          </button>
        </div>
        {inNow.length === 0 ? (
          <p className='text-3.5 text-secondary/50'>Nobody is timed in.</p>
        ) : (
          <ul className='divide-y divide-secondary/10'>
            {inNow.map((e) => (
              <li key={e.id} className='flex items-center justify-between py-2.5 gap-4'>
                <div className='min-w-0'>
                  <span className='font-medium text-secondary'>{e.name}</span>
                  <span className='text-xs text-secondary/60 ml-2'>
                    since {formatManilaDay(e.openSince!)}, {formatManilaTime(e.openSince!)}
                  </span>
                </div>
                <button onClick={() => setPunch({ action: 'time_out', employee: e })} className='text-xs font-semibold text-accent hover:underline shrink-0'>
                  Time out
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={panel}>
        <div className='flex flex-wrap items-center gap-2 mb-4'>
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => choosePreset(p.id)}
              className={`text-xs px-3 py-1.5 rounded-lg border ${
                preset === p.id ? 'bg-secondary text-primary border-secondary' : 'border-secondary/20 text-secondary'
              }`}>
              {p.label}
            </button>
          ))}
          <button
            disabled={!records?.length}
            onClick={() => records && downloadCsv(records, range.from, range.to)}
            className='ml-auto text-xs font-semibold text-secondary border border-secondary/20 px-3 py-1.5 rounded-lg disabled:opacity-40'>
            Download CSV
          </button>
        </div>
        {preset === 'custom' && (
          <div className='flex gap-3 mb-4'>
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
          <div className='flex items-center justify-center py-8'>
            <LoadingSpinner size='md' />
          </div>
        ) : records.length === 0 ? (
          <p className='text-3.5 text-secondary/50 py-4'>No time records in this range.</p>
        ) : (
          <>
            {totals.length > 1 || range.from !== range.to ? (
              <div className='mb-5'>
                <h4 className='text-xs font-bold text-secondary/60 tracking-wide mb-2'>TOTALS</h4>
                <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2'>
                  {totals.map((t) => (
                    <div key={t.id} className='bg-gray-50 rounded-lg px-3 py-2 text-3.5'>
                      <div className='font-semibold text-secondary truncate'>{t.name}</div>
                      <div className='text-xs text-secondary/70'>
                        {formatMinutes(t.minutes)} · {t.days.size} day{t.days.size === 1 ? '' : 's'}
                        {t.open > 0 && ' · shift still open'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className='overflow-x-auto'>
              <table className='w-full text-3.5'>
                <thead>
                  <tr className='text-left text-xs text-secondary/60 border-b border-secondary/10'>
                    <th className='py-2 pr-4 font-semibold'>Date</th>
                    <th className='py-2 pr-4 font-semibold'>Name</th>
                    <th className='py-2 pr-4 font-semibold'>Time in</th>
                    <th className='py-2 pr-4 font-semibold'>Time out</th>
                    <th className='py-2 font-semibold text-right'>Hours</th>
                  </tr>
                </thead>
                <tbody className='divide-y divide-secondary/10'>
                  {records.map((r) => (
                    <tr key={r.id} className='text-secondary'>
                      <td className='py-2 pr-4 whitespace-nowrap'>{formatManilaDay(r.timeIn)}</td>
                      <td className='py-2 pr-4'>{r.name}</td>
                      <td className='py-2 pr-4 whitespace-nowrap'>
                        {formatManilaTime(r.timeIn)}
                        <MethodBadge method={r.timeInMethod} />
                      </td>
                      <td className='py-2 pr-4 whitespace-nowrap'>
                        {r.timeOut ? (
                          <>
                            {formatManilaTime(r.timeOut)}
                            <MethodBadge method={r.timeOutMethod} />
                          </>
                        ) : (
                          <span className='text-success font-semibold'>In</span>
                        )}
                      </td>
                      <td className='py-2 text-right tabular-nums'>{r.minutes === null ? '—' : formatMinutes(r.minutes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {punch && (
        <ManualPunchModal
          branchId={branchId}
          action={punch.action}
          employee={punch.employee}
          choices={notIn}
          onClose={() => setPunch(null)}
          onDone={load}
        />
      )}
    </div>
  );
}
