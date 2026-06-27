"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useBranch } from "@/contexts/BranchContext";
import {
  cancelTransfer,
  getAllTransfers,
} from "@/services/transferService";
import type { TransferStatus, TransferWithItems } from "@/types/domain/transfer";
import LoadingSpinner from "@/components/LoadingSpinner";
import TopBar from "@/components/TopBar";
import MobileTopBar from "@/components/MobileTopBar";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-PH", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function uxLabel(t: TransferWithItems): { label: string; color: string } {
  if (t.status === "received") return { label: "Received", color: "bg-success/15 text-success" };
  if (t.status === "cancelled") return { label: "Cancelled", color: "bg-secondary/15 text-secondary/70" };
  if (t.direction === "pull" && !t.fulfilled_at) {
    return { label: "Awaiting fulfillment", color: "bg-amber-100 text-amber-700" };
  }
  return { label: "In transit", color: "bg-blue-100 text-blue-700" };
}

export default function OwnerTransfersPage() {
  const { user, isUserOwner } = useAuth();
  const { allBranches } = useBranch();

  const [statusFilter, setStatusFilter] = useState<"all" | TransferStatus>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("");
  const [destFilter, setDestFilter] = useState<string>("");
  const [transfers, setTransfers] = useState<TransferWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [actingId, setActingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!isUserOwner()) return;
    let cancelled = false;
    setLoading(true);
    getAllTransfers({
      status: statusFilter === "all" ? undefined : statusFilter,
      sourceBranchId: sourceFilter || undefined,
      destinationBranchId: destFilter || undefined,
      limit: 200,
    }).then(({ transfers, error }) => {
      if (cancelled) return;
      if (error) console.error(error);
      setTransfers(transfers);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [statusFilter, sourceFilter, destFilter, reload, isUserOwner]);

  const handleCancel = async (id: string) => {
    if (!user) return;
    const reason = window.prompt("Cancel reason (optional):") ?? "";
    setActingId(id);
    setActionError(null);
    const { error } = await cancelTransfer(user.id, id, reason);
    setActingId(null);
    if (error) {
      setActionError(error.message ?? String(error));
      return;
    }
    setReload(x => x + 1);
  };

  const summary = useMemo(() => {
    const live = transfers.filter(t => t.status === "sent");
    const inTransit = live.filter(t => t.direction === "push" || !!t.fulfilled_at).length;
    const awaitingFulfill = live.filter(t => t.direction === "pull" && !t.fulfilled_at).length;
    return {
      live: live.length,
      inTransit,
      awaitingFulfill,
      received: transfers.filter(t => t.status === "received").length,
      cancelled: transfers.filter(t => t.status === "cancelled").length,
    };
  }, [transfers]);

  if (!user || !isUserOwner()) {
    return (
      <div className="px-6 py-10 text-center text-sm text-secondary/60">Owner only.</div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="hidden xl:block">
        <TopBar />
      </div>
      <div className="xl:hidden">
        <MobileTopBar title="Distribution" />
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="mb-4">
          <h1 className="text-lg font-semibold text-secondary">All transfers</h1>
          <p className="text-xs text-secondary/60">Cross-branch view of every inventory transfer.</p>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <Stat label="Live" value={summary.live} />
          <Stat label="In transit" value={summary.inTransit} />
          <Stat label="Awaiting fulfill" value={summary.awaitingFulfill} />
          <Stat label="Received (total)" value={summary.received} />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-3 mb-3">
          <div>
            <p className="text-2.5 text-secondary/50 mb-1">Status</p>
            <div className="flex gap-1 flex-wrap">
              {(["all", "sent", "received", "cancelled"] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-2 py-1 rounded-md text-2.5 font-medium ${
                    statusFilter === s
                      ? "bg-accent text-primary"
                      : "bg-secondary/5 text-secondary/60 hover:text-secondary"
                  }`}>
                  {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-2.5 text-secondary/50 mb-1">Source branch</p>
            <select
              value={sourceFilter}
              onChange={e => setSourceFilter(e.target.value)}
              className="border border-secondary/20 rounded-lg h-9.5 px-3 text-3 focus:outline-none focus:ring-2 focus:ring-accent">
              <option value="">Any</option>
              {allBranches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <p className="text-2.5 text-secondary/50 mb-1">Destination branch</p>
            <select
              value={destFilter}
              onChange={e => setDestFilter(e.target.value)}
              className="border border-secondary/20 rounded-lg h-9.5 px-3 text-3 focus:outline-none focus:ring-2 focus:ring-accent">
              <option value="">Any</option>
              {allBranches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {actionError && (
          <div className="bg-error/10 border border-error/20 text-error text-2.5 px-3 py-2 rounded-lg mb-3">
            {actionError}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2">
            <LoadingSpinner size="md" />
            <p className="text-secondary text-xs">Loading...</p>
          </div>
        ) : transfers.length === 0 ? (
          <div className="bg-white border border-secondary/10 rounded-xl p-10 text-center text-xs text-secondary/50">
            No transfers in this view.
          </div>
        ) : (
          <div className="bg-white border border-secondary/10 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-secondary/5">
                <tr className="text-2.5 text-secondary/60 uppercase tracking-wide">
                  <th className="text-left px-4 py-2 font-medium">Transfer #</th>
                  <th className="text-left px-4 py-2 font-medium">Direction</th>
                  <th className="text-left px-4 py-2 font-medium">From → To</th>
                  <th className="text-right px-4 py-2 font-medium">Lines</th>
                  <th className="text-left px-4 py-2 font-medium">Created</th>
                  <th className="text-left px-4 py-2 font-medium">Status</th>
                  <th className="text-right px-4 py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map(t => {
                  const ux = uxLabel(t);
                  const totalQty = t.items.reduce((s, i) => s + i.quantity_sent, 0);
                  return (
                    <tr key={t.id} className="border-t border-secondary/10 text-xs">
                      <td className="px-4 py-3">
                        <Link
                          href={`/${t.source_branch_id}/transfers/${t.id}`}
                          className="text-accent hover:underline font-medium">
                          {t.transfer_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3 capitalize text-secondary/70">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md text-2.5 font-medium ${
                            t.direction === "push"
                              ? "bg-blue-50 text-blue-700"
                              : "bg-purple-50 text-purple-700"
                          }`}>
                          {t.direction}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-secondary/80">
                        {t.source_branch_name ?? "—"}
                        <span className="text-secondary/30 mx-1.5">→</span>
                        {t.destination_branch_name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {t.items.length} <span className="text-secondary/40">({totalQty})</span>
                      </td>
                      <td className="px-4 py-3 text-secondary/60">{formatDate(t.created_at)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-md text-2.5 font-medium ${ux.color}`}>
                          {ux.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {t.status === "sent" ? (
                          <button
                            onClick={() => handleCancel(t.id)}
                            disabled={actingId === t.id}
                            className={`px-2 py-1 rounded-md text-2.5 font-semibold ${
                              actingId === t.id
                                ? "bg-gray-100 text-secondary/50 cursor-not-allowed"
                                : "bg-error/10 text-error hover:bg-error/20"
                            }`}>
                            {actingId === t.id ? "..." : "Cancel"}
                          </button>
                        ) : (
                          <span className="text-secondary/30 text-2.5">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white border border-secondary/10 rounded-xl p-3">
      <p className="text-2.5 text-secondary/50 uppercase tracking-wide">{label}</p>
      <p className="text-base font-semibold text-secondary mt-0.5 tabular-nums">{value}</p>
    </div>
  );
}
