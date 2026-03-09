"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { motion } from "motion/react";
import LogsIcon from "@/components/icons/SidebarNav/LogsIcon";
import TopBar from "@/components/TopBar";
import MobileTopBar from "@/components/MobileTopBar";
import LoadingSpinner from "@/components/LoadingSpinner";
import { getAllActivityLogs, subscribeToAllActivityLogs } from "@/services/activityLogService";
import { branchService } from "@/services/branchService";
import type { ActivityLog, Branch } from "@/types/domain";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type DateFilter = "today" | "7d" | "30d" | "all";
type TypeFilter = "all" | "auth" | "attendance" | "inventory" | "bundles" | "orders" | "discounts";

const TYPE_ACTIONS: Record<string, string[]> = {
  auth: ["login", "logout"],
  attendance: ["time_in", "time_out"],
  inventory: [
    "item_created", "item_deleted", "item_renamed",
    "item_price_changed", "item_photo_changed", "item_category_changed",
    "stock_added", "stock_removed",
  ],
  bundles: ["bundle_created", "bundle_updated", "bundle_deleted", "bundle_status_changed"],
  orders: ["order_created"],
  discounts: ["discount_created", "discount_updated", "discount_deleted"],
};

const TYPE_PILLS: { key: TypeFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "auth", label: "Auth" },
  { key: "attendance", label: "Attendance" },
  { key: "inventory", label: "Inventory" },
  { key: "bundles", label: "Bundles" },
  { key: "orders", label: "Orders" },
  { key: "discounts", label: "Discounts" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getDateRange(filter: DateFilter): { from?: Date; to?: Date } {
  const now = new Date();
  if (filter === "today") {
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const to = new Date(from.getTime() + 86_400_000 - 1);
    return { from, to };
  }
  if (filter === "7d") return { from: new Date(now.getTime() - 7 * 86_400_000) };
  if (filter === "30d") return { from: new Date(now.getTime() - 30 * 86_400_000) };
  return {};
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDateLabel(dateStr: string): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const yesterday = new Date(now.getTime() - 86_400_000);
  const yStr = `${yesterday.getFullYear()}-${pad(yesterday.getMonth() + 1)}-${pad(yesterday.getDate())}`;
  if (dateStr === todayStr) return "Today";
  if (dateStr === yStr) return "Yesterday";
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
}

function formatDescription(log: ActivityLog): string {
  const d = log.details ?? {};
  const who = log.user_name ?? "Unknown";
  switch (log.action) {
    case "login":               return `${who} logged in`;
    case "logout":              return `${who} logged out`;
    case "time_in":             return `${who} clocked in`;
    case "time_out":            return `${who} clocked out`;
    case "item_created":        return `${who} added item "${d.name ?? ""}"`;
    case "item_deleted":        return `${who} deleted item "${d.name ?? ""}"`;
    case "item_renamed":        return `${who} renamed "${d.old_name ?? ""}" → "${d.new_name ?? ""}"`;
    case "item_price_changed":  return `${who} changed price · "${d.item_name ?? ""}" ₱${d.old_price} → ₱${d.new_price}`;
    case "item_photo_changed":  return `${who} updated photo · "${d.item_name ?? ""}"`;
    case "item_category_changed": return `${who} changed category · "${d.item_name ?? ""}"`;
    case "stock_added":         return `${who} added ${d.delta ?? ""} stock · ${d.item_name ?? ""}`;
    case "stock_removed":       return `${who} removed ${d.delta ?? ""} stock · ${d.item_name ?? ""}`;
    case "bundle_created":      return `${who} created bundle "${d.name ?? ""}"`;
    case "bundle_updated":      return `${who} updated bundle "${d.name ?? ""}"`;
    case "bundle_status_changed": return `${who} set bundle "${d.name ?? ""}" to ${d.status ?? ""}`;
    case "bundle_deleted":      return `${who} deleted bundle "${d.name ?? ""}"`;
    case "discount_created":    return `${who} created discount "${d.name ?? ""}"`;
    case "discount_updated":    return `${who} updated discount "${d.name ?? ""}"`;
    case "discount_deleted":    return `${who} deleted discount "${d.name ?? ""}"`;
    case "worker_added":        return `${who} added worker "${d.worker_name ?? ""}"`;
    case "worker_removed":      return `${who} removed worker "${d.worker_name ?? ""}"`;
    default:                    return `${who} · ${log.action.replace(/_/g, " ")}`;
  }
}

function shortId(id: string): string {
  return id.replace(/-/g, "").slice(0, 6).toUpperCase();
}

interface IconCfg { bg: string; text: string }

function getIconCfg(action: string): IconCfg {
  if (["login", "logout"].includes(action))              return { bg: "bg-indigo-100", text: "text-indigo-500" };
  if (action === "time_in")                              return { bg: "bg-emerald-100", text: "text-emerald-600" };
  if (action === "time_out")                             return { bg: "bg-red-100", text: "text-red-500" };
  if (["item_created", "item_deleted", "item_renamed",
       "item_price_changed", "item_photo_changed",
       "item_category_changed"].includes(action))        return { bg: "bg-sky-100", text: "text-sky-500" };
  if (action === "stock_added")                         return { bg: "bg-green-100", text: "text-green-600" };
  if (action === "stock_removed")                       return { bg: "bg-amber-100", text: "text-amber-600" };
  if (action.startsWith("bundle"))                      return { bg: "bg-bundle/10", text: "text-bundle" };
  if (action === "order_created")                       return { bg: "bg-accent/10", text: "text-accent" };
  if (action.startsWith("discount"))                    return { bg: "bg-purple-100", text: "text-purple-500" };
  if (action.startsWith("worker"))                      return { bg: "bg-pink-100", text: "text-pink-500" };
  return { bg: "bg-secondary/10", text: "text-secondary" };
}

function LogIconEl({ action }: { action: string }) {
  const { bg, text } = getIconCfg(action);
  const s = `w-3.5 h-3.5 ${text}`;
  let svg: React.ReactNode;
  if (["login", "logout"].includes(action)) {
    svg = <svg className={s} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>;
  } else if (["time_in", "time_out"].includes(action)) {
    svg = <svg className={s} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>;
  } else if (["item_created","item_deleted","item_renamed","item_price_changed","item_photo_changed","item_category_changed","stock_added","stock_removed"].includes(action)) {
    svg = <svg className={s} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>;
  } else if (action.startsWith("bundle")) {
    svg = <svg className={s} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>;
  } else if (action === "order_created") {
    svg = <svg className={s} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>;
  } else if (action.startsWith("discount")) {
    svg = <svg className={s} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/></svg>;
  } else {
    svg = <svg className={s} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>;
  }
  return <div className={`w-6 h-6 rounded-full ${bg} flex items-center justify-center shrink-0`}>{svg}</div>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function LogsScreen() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const topRef = useRef<HTMLDivElement>(null);
  const newLogIds = useRef<Set<string>>(new Set());

  // Branch name lookup map
  const branchMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const b of branches) map[b.id] = b.name;
    return map;
  }, [branches]);

  // Fetch branches once
  useEffect(() => {
    branchService.getAllBranches().then(({ branches: fetched }) => {
      setBranches(fetched ?? []);
    });
  }, []);

  // Fetch logs when date filter changes
  useEffect(() => {
    setLoading(true);
    setFetchError(null);
    const { from, to } = getDateRange(dateFilter);
    getAllActivityLogs({ from, to }).then(({ logs: fetched, error }) => {
      if (error) setFetchError(String(error?.message ?? error));
      setLogs(fetched);
      setLoading(false);
    });
  }, [dateFilter]);

  // Realtime subscription — all branches
  useEffect(() => {
    const unsub = subscribeToAllActivityLogs((newLog) => {
      newLogIds.current.add(newLog.id);
      setLogs(prev => [newLog, ...prev]);
      setTimeout(() => topRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    });
    return unsub;
  }, []);

  // Client-side filters
  const filtered = useMemo(() => {
    let result = logs;
    if (branchFilter !== "all") {
      result = result.filter(l => l.branch_id === branchFilter);
    }
    if (typeFilter !== "all") {
      const allowed = TYPE_ACTIONS[typeFilter] ?? [];
      result = result.filter(l => allowed.includes(l.action));
    }
    return result;
  }, [logs, branchFilter, typeFilter]);

  // Group by date
  const groups = useMemo(() => {
    const map = new Map<string, ActivityLog[]>();
    for (const log of filtered) {
      const dateKey = log.created_at.slice(0, 10);
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(log);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([dateKey, dayLogs]) => [
        dateKey,
        [...dayLogs].sort((a, b) => b.created_at.localeCompare(a.created_at)),
      ] as [string, ActivityLog[]]);
  }, [filtered]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex flex-col flex-1 h-full overflow-hidden">
        {/* TopBar */}
        <div className="xl:hidden w-full">
          <MobileTopBar title="Logs" icon={<LogsIcon />} />
        </div>
        <div className="hidden xl:block w-full">
          <TopBar title="Logs" icon={<LogsIcon />} />
        </div>

        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Filter bar */}
          <div className="px-4 pt-3 pb-2 border-b border-secondary/10 flex flex-col gap-2">
            {/* Row 1: type pills + date */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 flex-wrap flex-1">
                {TYPE_PILLS.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setTypeFilter(key)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${
                      typeFilter === key
                        ? "bg-secondary text-white"
                        : "bg-secondary/10 text-secondary/60 hover:bg-secondary/20"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <select
                value={dateFilter}
                onChange={e => setDateFilter(e.target.value as DateFilter)}
                className="text-[11px] font-semibold text-secondary bg-secondary/10 rounded-full px-2.5 py-1 border-none focus:outline-none focus:ring-2 focus:ring-secondary/30 shrink-0"
              >
                <option value="today">Today</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="all">All time</option>
              </select>
            </div>

            {/* Row 2: branch pills */}
            {branches.length > 1 && (
              <div className="flex items-center gap-1 flex-wrap">
                <button
                  onClick={() => setBranchFilter("all")}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${
                    branchFilter === "all"
                      ? "bg-secondary text-white"
                      : "bg-secondary/10 text-secondary/60 hover:bg-secondary/20"
                  }`}
                >
                  All branches
                </button>
                {branches.map(b => (
                  <button
                    key={b.id}
                    onClick={() => setBranchFilter(b.id)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${
                      branchFilter === b.id
                        ? "bg-secondary text-white"
                        : "bg-secondary/10 text-secondary/60 hover:bg-secondary/20"
                    }`}
                  >
                    {b.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Feed */}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <LoadingSpinner size="md" />
              </div>
            ) : fetchError ? (
              <div className="flex flex-col items-center justify-center h-full text-red-400 gap-1">
                <p className="text-xs font-semibold">Failed to load logs</p>
                <p className="text-[10px] text-secondary/50 text-center max-w-xs">{fetchError}</p>
              </div>
            ) : groups.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-secondary/40">
                <svg className="w-10 h-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="text-xs">No activity found</p>
              </div>
            ) : (
              <div>
                {/* Scroll anchor (top) */}
                <div ref={topRef} />

                {/* Latest marker */}
                <div className="flex items-center gap-2.5 pl-2 pb-2">
                  <div className="w-6 flex justify-center shrink-0">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  </div>
                  <span className="text-[9px] font-semibold text-secondary/30 uppercase tracking-widest">Latest</span>
                </div>

                {groups.map(([dateKey, dayLogs]) => (
                  <div key={dateKey}>
                    {/* Date separator */}
                    <div className="flex items-center gap-2 py-2">
                      <div className="flex-1 h-px bg-secondary/10" />
                      <span className="text-[10px] font-semibold text-secondary/40 uppercase tracking-wide shrink-0">
                        {formatDateLabel(dateKey)}
                      </span>
                      <div className="flex-1 h-px bg-secondary/10" />
                    </div>

                    {/* Log rows */}
                    <div>
                      {dayLogs.map((log, idx) => {
                        const isLastInGroup = idx === dayLogs.length - 1;
                        const isNew = newLogIds.current.has(log.id);
                        return (
                          <motion.div
                            key={log.id}
                            initial={isNew ? { x: 20, opacity: 0, scale: 0.96 } : false}
                            animate={{ x: 0, opacity: 1, scale: 1 }}
                            transition={{ type: "spring", stiffness: 480, damping: 24, mass: 0.75 }}
                            className="flex gap-2.5 pl-2 pr-2 rounded-lg hover:bg-secondary/5 transition-colors"
                          >
                            {/* Timeline column: icon + connector */}
                            <div className="flex flex-col items-center w-6 shrink-0">
                              <div className="pt-1.5">
                                <LogIconEl action={log.action} />
                              </div>
                              {!isLastInGroup && (
                                <div className="flex-1 min-h-3 mt-1 border-l-2 border-dashed border-secondary/15" />
                              )}
                            </div>
                            {/* Content */}
                            <div className={`flex-1 min-w-0 flex items-center gap-2 py-1.5 ${!isLastInGroup ? "pb-3" : ""}`}>
                              <div className="flex-1 min-w-0">
                                {log.action === "order_created" && log.entity_id ? (
                                  <Link
                                    href={`/${log.branch_id}/sales`}
                                    className="text-xs font-medium text-accent hover:underline"
                                  >
                                    Order #{shortId(log.entity_id)} →
                                  </Link>
                                ) : (
                                  <p className="text-xs text-secondary truncate">
                                    {formatDescription(log)}
                                  </p>
                                )}
                              </div>
                              {/* Branch tag — only shown when viewing all branches */}
                              {branchFilter === "all" && log.branch_id && branchMap[log.branch_id] && (
                                <span className="text-[9px] font-medium text-secondary/40 bg-secondary/8 px-1.5 py-0.5 rounded-full shrink-0 max-w-[80px] truncate">
                                  {branchMap[log.branch_id]}
                                </span>
                              )}
                              <span className="text-[10px] text-secondary/40 tabular-nums shrink-0">
                                {formatTime(log.created_at)}
                              </span>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                ))}


                {/* Oldest marker */}
                <div className="flex items-center gap-2.5 pl-2 pt-2">
                  <div className="w-6 flex justify-center shrink-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-secondary/25" />
                  </div>
                  <span className="text-[9px] font-semibold text-secondary/30 uppercase tracking-widest">Oldest</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
