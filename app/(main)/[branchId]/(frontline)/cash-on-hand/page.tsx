"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  getCashOnHandForDate,
  subscribeToCashOnHand,
} from "@/services/cashOnHandService";
import type { CashOnHand } from "@/types/domain/cashOnHand";
import { formatCurrency } from "@/lib/currency_formatter";
import PageLoader from "@/components/PageLoader";
import TopBar from "@/components/TopBar";
import MobileTopBar from "@/components/MobileTopBar";
import CashOnHandIcon from "@/components/icons/SidebarNav/CashOnHandIcon";
import SetCashOnHandModal from "./components/SetCashOnHandModal";
import CashOnHandHistoryModal from "./components/CashOnHandHistoryModal";

// ---------------------------------------------------------------------------
// Date helpers (business day = Asia/Manila, matching the midnight pg_cron job)
// ---------------------------------------------------------------------------
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function manilaToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function daysInMonth(ym: string): number {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

function weekdayOfFirst(ym: string): number {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).getDay();
}

function addMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function dayStr(ym: string, day: number): string {
  return `${ym}-${pad(day)}`;
}

function monthEnd(ym: string): string {
  return dayStr(ym, daysInMonth(ym));
}

function formatDateLabel(dateStr: string, today: string): string {
  if (dateStr === today) return "Today";
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// Compact peso for tight calendar cells (exact value lives in the modal/history)
function amountShort(n: number): string {
  if (n >= 1000) {
    const k = n / 1000;
    return `₱${k % 1 === 0 ? k : k.toFixed(1)}k`;
  }
  return `₱${Math.round(n)}`;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function CashOnHandPage() {
  const params = useParams();
  const branchId = params.branchId as string;
  const { user, isUserOwner, isManager, getUserRoleForBranch } = useAuth();

  const today = manilaToday();
  const currentMonth = today.slice(0, 7);
  const canEdit =
    isUserOwner() || isManager() || getUserRoleForBranch(branchId) !== null;

  const [viewMonth, setViewMonth] = useState(currentMonth);
  const [monthEntries, setMonthEntries] = useState<CashOnHand[]>([]);
  const [todayEntry, setTodayEntry] = useState<CashOnHand | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [setModalOpen, setSetModalOpen] = useState(false);
  const [setModalDate, setSetModalDate] = useState(today);
  const [historyEntry, setHistoryEntry] = useState<CashOnHand | null>(null);

  // Calendar month: fetch + realtime subscribe for the visible month
  useEffect(() => {
    if (!branchId) return;
    let cancelled = false;
    setLoading(true);

    const start = dayStr(viewMonth, 1);
    const end = monthEnd(viewMonth);

    const unsub = subscribeToCashOnHand(branchId, start, end, (e) => {
      if (cancelled) return;
      setMonthEntries(e);
      setLoading(false);
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, [branchId, viewMonth]);

  // Today card: independent fetch + realtime so it stays live regardless of the
  // month being browsed.
  useEffect(() => {
    if (!branchId) return;
    let cancelled = false;

    getCashOnHandForDate(branchId, today).then(({ entry }) => {
      if (!cancelled) setTodayEntry(entry);
    });

    const unsub = subscribeToCashOnHand(branchId, today, today, (e) => {
      if (!cancelled) setTodayEntry(e[0] ?? null);
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, [branchId, today]);

  const monthMap = useMemo(() => {
    const m = new Map<string, CashOnHand>();
    for (const e of monthEntries) m.set(e.business_date, e);
    return m;
  }, [monthEntries]);

  // Build the calendar grid cells (leading blanks + each day of the month)
  const cells = useMemo(() => {
    const blanks = weekdayOfFirst(viewMonth);
    const total = daysInMonth(viewMonth);
    const out: (number | null)[] = [];
    for (let i = 0; i < blanks; i++) out.push(null);
    for (let d = 1; d <= total; d++) out.push(d);
    return out;
  }, [viewMonth]);

  const openSetModal = (date: string) => {
    setSetModalDate(date);
    setSetModalOpen(true);
  };

  const handleDayClick = (date: string) => {
    if (date > today) return; // future is not actionable
    const entry = monthMap.get(date);
    if (canEdit) {
      openSetModal(date);
    } else if (entry) {
      setHistoryEntry(entry);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="hidden xl:block">
        <TopBar />
      </div>
      <div className="xl:hidden">
        <MobileTopBar title="Cash on Hand" />
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-9 h-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center">
            <CashOnHandIcon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-secondary leading-tight">Cash on Hand</h1>
            <p className="text-3 text-secondary/50">Tracked per day · ends at midnight</p>
          </div>
        </div>

        <div className="max-w-2xl mx-auto">
          {/* Today card */}
          <div className="rounded-xl border border-secondary/10 bg-white p-5 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-3.5 font-medium text-secondary/60">Today</span>
              <span className="inline-flex items-center gap-1.5 text-3 font-medium text-(--success) bg-(--success)/10 rounded-full px-2.5 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-(--success)" />
                Open
              </span>
            </div>

            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-3xl font-bold text-secondary tracking-tight">
                  {todayEntry ? formatCurrency(todayEntry.amount) : "—"}
                </p>
                <p className="text-3 text-secondary/50 mt-1">
                  {todayEntry ? `Last updated ${formatTime(todayEntry.updated_at)}` : "Not set yet"}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {todayEntry && (
                  <button
                    type="button"
                    onClick={() => setHistoryEntry(todayEntry)}
                    className="px-3 py-2 text-3.5 border border-secondary/30 text-secondary/70 rounded-md hover:bg-secondary/5"
                  >
                    History
                  </button>
                )}
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => openSetModal(today)}
                    className="px-4 py-2 text-3.5 bg-accent text-white rounded-md hover:bg-accent/80"
                  >
                    {todayEntry ? "Update" : "Set amount"}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Calendar */}
          <div className="rounded-xl border border-secondary/10 bg-white p-4">
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={() => setViewMonth((m) => addMonth(m, -1))}
                aria-label="Previous month"
                className="w-8 h-8 flex items-center justify-center rounded-md text-secondary/60 hover:bg-secondary/5"
              >
                ‹
              </button>
              <div className="flex items-center gap-2">
                <span className="text-3.5 font-semibold text-secondary">{monthLabel(viewMonth)}</span>
                {viewMonth !== currentMonth && (
                  <button
                    type="button"
                    onClick={() => setViewMonth(currentMonth)}
                    className="text-3 text-accent hover:underline"
                  >
                    Today
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setViewMonth((m) => addMonth(m, 1))}
                aria-label="Next month"
                className="w-8 h-8 flex items-center justify-center rounded-md text-secondary/60 hover:bg-secondary/5"
              >
                ›
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-1">
              {WEEKDAYS.map((w) => (
                <div key={w} className="text-center text-3 font-medium text-secondary/40 py-1">
                  {w}
                </div>
              ))}
            </div>

            {loading ? (
              <div className="py-10">
                <PageLoader text="Loading…" />
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-1">
                {cells.map((day, idx) => {
                  if (day === null) return <div key={`b-${idx}`} />;
                  const date = dayStr(viewMonth, day);
                  const entry = monthMap.get(date);
                  const isFuture = date > today;
                  const isToday = date === today;
                  const isPast = date < today;
                  const missingPast = !entry && isPast;

                  let cls = "border-secondary/10 bg-white hover:bg-secondary/5";
                  if (isFuture) cls = "border-transparent bg-transparent text-secondary/25 cursor-default";
                  else if (missingPast) cls = "border-amber-200 bg-amber-50 hover:bg-amber-100";
                  else if (isToday) cls = "border-accent bg-accent/5 hover:bg-accent/10";

                  return (
                    <button
                      key={date}
                      type="button"
                      disabled={isFuture}
                      onClick={() => handleDayClick(date)}
                      className={`aspect-square rounded-lg border p-1 flex flex-col items-center justify-start gap-0.5 text-center transition-colors ${cls}`}
                    >
                      <span
                        className={`text-3 leading-none ${
                          isToday
                            ? "font-bold text-accent"
                            : missingPast
                            ? "text-amber-600"
                            : "text-secondary/60"
                        }`}
                      >
                        {day}
                      </span>
                      {entry ? (
                        <span className="text-3 font-semibold text-secondary leading-tight truncate w-full">
                          {amountShort(entry.amount)}
                        </span>
                      ) : missingPast ? (
                        <span className="text-3 text-amber-500 leading-none">—</span>
                      ) : null}
                      {entry && entry.status === "ended" && (
                        <span className="w-1 h-1 rounded-full bg-secondary/30" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-4 pt-3 border-t border-secondary/10">
              <span className="inline-flex items-center gap-1.5 text-3 text-secondary/50">
                <span className="w-2.5 h-2.5 rounded border border-accent bg-accent/10" /> Today
              </span>
              <span className="inline-flex items-center gap-1.5 text-3 text-secondary/50">
                <span className="w-2.5 h-2.5 rounded border border-secondary/20 bg-white" /> Recorded
              </span>
              <span className="inline-flex items-center gap-1.5 text-3 text-secondary/50">
                <span className="w-2.5 h-2.5 rounded border border-amber-200 bg-amber-50" /> No cash · auto-ended
              </span>
            </div>
          </div>
        </div>
      </div>

      <SetCashOnHandModal
        isOpen={setModalOpen}
        onClose={() => setSetModalOpen(false)}
        onSaved={() => { /* realtime subscription refreshes the calendar & today card */ }}
        branchId={branchId}
        businessDate={setModalDate}
        dateLabel={formatDateLabel(setModalDate, today)}
        currentAmount={monthMap.get(setModalDate)?.amount ?? (setModalDate === today ? todayEntry?.amount ?? null : null)}
        userId={user?.id ?? null}
        onViewHistory={() => {
          const e = monthMap.get(setModalDate) ?? (setModalDate === today ? todayEntry : null);
          if (e) {
            setSetModalOpen(false);
            setHistoryEntry(e);
          }
        }}
      />

      <CashOnHandHistoryModal
        isOpen={historyEntry !== null}
        onClose={() => setHistoryEntry(null)}
        cashOnHandId={historyEntry?.id ?? null}
        dateLabel={historyEntry ? formatDateLabel(historyEntry.business_date, today) : ""}
      />
    </div>
  );
}
