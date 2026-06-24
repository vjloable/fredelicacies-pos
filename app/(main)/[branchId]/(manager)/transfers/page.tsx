"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useBranch } from "@/contexts/BranchContext";
import {
  getBranchTransfers,
  subscribeToBranchTransfers,
} from "@/services/transferService";
import type { TransferWithItems } from "@/types/domain/transfer";
import LoadingSpinner from "@/components/LoadingSpinner";
import TopBar from "@/components/TopBar";
import MobileTopBar from "@/components/MobileTopBar";

type Tab = "incoming" | "outgoing" | "history";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-PH", {
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

export default function TransfersListPage() {
  const params = useParams();
  const branchId = typeof params.branchId === "string" ? params.branchId : "";
  const { user, getUserRoleForBranch, isUserOwner } = useAuth();
  const { currentBranch } = useBranch();

  const role = getUserRoleForBranch(branchId);
  const isOwner = isUserOwner();
  const isManager = isOwner || role === "manager";

  const [tab, setTab] = useState<Tab>("incoming");
  const [loading, setLoading] = useState(true);
  const [transfers, setTransfers] = useState<TransferWithItems[]>([]);

  useEffect(() => {
    if (!branchId) return;
    let cancelled = false;
    setLoading(true);
    getBranchTransfers(branchId).then(({ transfers, error }) => {
      if (cancelled) return;
      if (error) {
        console.error("Failed to load transfers", error);
      }
      setTransfers(transfers);
      setLoading(false);
    });
    const unsub = subscribeToBranchTransfers(branchId, () => {
      getBranchTransfers(branchId).then(({ transfers }) => {
        if (!cancelled) setTransfers(transfers);
      });
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [branchId]);

  const filtered = useMemo(() => {
    if (tab === "incoming") {
      return transfers.filter(t => t.destination_branch_id === branchId && t.status === "sent");
    }
    if (tab === "outgoing") {
      return transfers.filter(t => t.source_branch_id === branchId && t.status === "sent");
    }
    return transfers.filter(t => t.status === "received" || t.status === "cancelled");
  }, [transfers, tab, branchId]);

  return (
    <div className="flex flex-col h-full">
      <div className="hidden xl:block">
        <TopBar />
      </div>
      <div className="xl:hidden">
        <MobileTopBar title="Distribution" />
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="flex items-center justify-between mb-4 gap-3">
          <div>
            <h1 className="text-lg font-semibold text-secondary">Distribution</h1>
            <p className="text-xs text-secondary/60">
              Move inventory between {currentBranch?.name ?? "this branch"} and other branches.
            </p>
          </div>
          {isManager && (
            <Link
              href={`/${branchId}/transfers/new`}
              className="px-4 py-2 bg-accent text-primary text-xs font-semibold rounded-lg hover:bg-accent/90 transition-colors shrink-0">
              + New transfer
            </Link>
          )}
        </div>

        <div className="flex items-center gap-1.5 mb-4 flex-wrap">
          {(["incoming", "outgoing", "history"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1 rounded-md text-2.5 font-medium transition-colors capitalize ${
                tab === t ? "bg-accent text-primary" : "bg-secondary/5 text-secondary/50 hover:text-secondary"
              }`}>
              {t === "incoming" ? "Incoming" : t === "outgoing" ? "Outgoing" : "History"}
              <span className="ml-1.5 text-[10px] opacity-70">
                {t === "incoming"
                  ? transfers.filter(x => x.destination_branch_id === branchId && x.status === "sent").length
                  : t === "outgoing"
                  ? transfers.filter(x => x.source_branch_id === branchId && x.status === "sent").length
                  : transfers.filter(x => x.status === "received" || x.status === "cancelled").length}
              </span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2">
            <LoadingSpinner size="md" />
            <p className="text-secondary text-xs">Loading...</p>
          </div>
        ) : filtered.length === 0 ? (
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
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => {
                  const ux = uxLabel(t);
                  const totalQty = t.items.reduce((s, i) => s + i.quantity_sent, 0);
                  const isOutgoing = t.source_branch_id === branchId;
                  return (
                    <tr key={t.id} className="border-t border-secondary/10 text-xs">
                      <td className="px-4 py-3">
                        <Link
                          href={`/${branchId}/transfers/${t.id}`}
                          className="text-accent hover:underline font-medium">
                          {t.transfer_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3 capitalize text-secondary/70">
                        <span className={`inline-block px-2 py-0.5 rounded-md text-2.5 font-medium ${
                          t.direction === "push" ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"
                        }`}>
                          {t.direction}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-secondary/80">
                        {t.source_branch_name ?? "—"}
                        <span className="text-secondary/30 mx-1.5">→</span>
                        {t.destination_branch_name ?? "—"}
                        {isOutgoing && <span className="ml-2 text-2.5 text-secondary/40">(outgoing)</span>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {t.items.length} <span className="text-secondary/40">({totalQty} pcs)</span>
                      </td>
                      <td className="px-4 py-3 text-secondary/60">{formatDate(t.created_at)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-md text-2.5 font-medium ${ux.color}`}>
                          {ux.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!isManager && role === "worker" && (
          <p className="mt-3 text-2.5 text-secondary/40">
            You're viewing as a worker. You can mark incoming transfers received, but only managers can create or cancel.
          </p>
        )}
        {!user && (
          <p className="mt-3 text-2.5 text-secondary/40">Sign in required.</p>
        )}
      </div>
    </div>
  );
}
