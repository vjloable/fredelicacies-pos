"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useBranch } from "@/contexts/BranchContext";
import {
  getBranchTransfers,
  subscribeToBranchTransfers,
  fulfillPullRequest,
  cancelTransfer,
} from "@/services/transferService";
import type { TransferWithItems } from "@/types/domain/transfer";
import LoadingSpinner from "@/components/LoadingSpinner";
import TopBar from "@/components/TopBar";
import MobileTopBar from "@/components/MobileTopBar";
import PlusIcon from "@/components/icons/PlusIcon";

function totalPcs(t: TransferWithItems): number {
  return t.items.reduce((s, i) => s + (i.quantity_sent ?? 0), 0);
}

// ── Lane definitions ──────────────────────────────────────────────────────────
// Lane 1 "Requests": pull, not yet fulfilled
// Lane 2 "In transit": push OR fulfilled pull, still status=sent
// Lane 3 "Completed": received or cancelled (capped at 30)

function KanbanCard({
  t,
  branchId,
  isManager,
  userId,
}: {
  t: TransferWithItems;
  branchId: string;
  isManager: boolean;
  userId: string | undefined;
}) {
  const [busy, setBusy] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);

  // Lane 1 — Requests
  const isActionableRequest =
    t.status === "sent" &&
    t.direction === "pull" &&
    !t.fulfilled_at &&
    t.source_branch_id === branchId;

  const isAwaitingRequest =
    t.status === "sent" &&
    t.direction === "pull" &&
    !t.fulfilled_at &&
    t.destination_branch_id === branchId;

  // Lane 2 — In transit
  const isIncomingTransit =
    t.status === "sent" &&
    (t.direction === "push" || !!t.fulfilled_at) &&
    t.destination_branch_id === branchId;

  const isOutgoingTransit =
    t.status === "sent" &&
    (t.direction === "push" || !!t.fulfilled_at) &&
    t.source_branch_id === branchId;

  // Lane 3 — Completed
  const isCompleted = t.status === "received" || t.status === "cancelled";

  // Counterpart label
  let counterpart = "";
  if (isActionableRequest) counterpart = `From ${t.destination_branch_name ?? "Branch"}`;
  else if (isAwaitingRequest) counterpart = `From ${t.source_branch_name ?? "Branch"}`;
  else if (isIncomingTransit) counterpart = `From ${t.source_branch_name ?? "Branch"}`;
  else if (isOutgoingTransit) counterpart = `To ${t.destination_branch_name ?? "Branch"}`;
  else if (isCompleted) {
    if (t.source_branch_id === branchId) counterpart = `To ${t.destination_branch_name ?? "Branch"}`;
    else counterpart = `From ${t.source_branch_name ?? "Branch"}`;
  }

  const handleConfirm = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!userId) return;
    setBusy(true);
    setErr(null);
    const { error } = await fulfillPullRequest(userId, t.id);
    setBusy(false);
    if (error) setErr(error.message ?? "Failed to confirm");
  };

  const handleDeclineSubmit = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!userId) return;
    setBusy(true);
    setErr(null);
    const { error } = await cancelTransfer(userId, t.id, reason);
    setBusy(false);
    if (error) {
      setErr(error.message ?? "Failed to decline");
    } else {
      setDeclining(false);
      setReason("");
    }
  };

  return (
    <div className="bg-white border border-secondary/10 rounded-lg p-3 flex flex-col gap-2">
      {err && (
        <div className="px-2 py-1 rounded-md bg-(--error)/5 border border-(--error)/20 text-2.5 text-(--error)">{err}</div>
      )}

      {/* Card body — link to detail */}
      <Link
        href={`/${branchId}/transfers/${t.id}`}
        className="flex flex-col gap-0.5 hover:opacity-75 transition-opacity"
      >
        <span className="text-xs font-semibold text-secondary truncate">{counterpart}</span>
        <span className="text-2.5 font-mono text-secondary/50">{t.transfer_number}</span>
        <span className="text-2.5 text-secondary/50">{totalPcs(t)} pcs · {t.items.length} {t.items.length === 1 ? "line" : "lines"}</span>
      </Link>

      {/* Status tag or action row */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {isAwaitingRequest && (
          <span className="px-1.5 py-0.5 rounded-full text-2.5 font-bold bg-amber-100 text-amber-700">Awaiting fulfilment</span>
        )}
        {isOutgoingTransit && (
          <span className="px-1.5 py-0.5 rounded-full text-2.5 font-bold bg-accent/10 text-accent">In transit</span>
        )}
        {isIncomingTransit && (
          <Link
            href={`/${branchId}/transfers/${t.id}`}
            className="px-2 py-0.5 rounded-lg bg-accent/10 text-accent text-2.5 font-bold hover:bg-accent/20 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            Receive →
          </Link>
        )}
        {isCompleted && t.status === "received" && (
          <span className="px-1.5 py-0.5 rounded-full text-2.5 font-bold bg-(--success)/10 text-(--success)">Received</span>
        )}
        {isCompleted && t.status === "cancelled" && (
          <span className="px-1.5 py-0.5 rounded-full text-2.5 font-bold bg-secondary/10 text-secondary/50" title={t.cancel_reason ?? undefined}>
            Cancelled{t.cancel_reason ? ` · ${t.cancel_reason}` : ""}
          </span>
        )}
        {isActionableRequest && isManager && !declining && (
          <>
            <button
              onClick={handleConfirm}
              disabled={busy}
              className="h-7 px-2.5 inline-flex items-center rounded-lg bg-(--success) text-white text-2.5 font-bold hover:opacity-90 transition-all active:scale-95 disabled:opacity-50"
            >
              {busy ? "…" : "Confirm"}
            </button>
            <button
              onClick={(e) => { e.preventDefault(); setDeclining(true); setReason(""); }}
              disabled={busy}
              className="h-7 px-2.5 inline-flex items-center rounded-lg border border-(--error)/30 text-(--error) text-2.5 font-bold hover:bg-(--error)/10 transition-all active:scale-95 disabled:opacity-50"
            >
              Decline
            </button>
          </>
        )}
      </div>

      {/* Inline decline reason */}
      {isActionableRequest && isManager && declining && (
        <div className="flex items-center gap-1.5 mt-0.5">
          <input
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional)…"
            className="flex-1 h-7 px-2.5 text-2.5 rounded-lg border border-secondary/20 focus:outline-none focus:ring-2 focus:ring-(--error)/40"
            onClick={(e) => e.preventDefault()}
          />
          <button
            onClick={handleDeclineSubmit}
            disabled={busy}
            className="h-7 px-2.5 inline-flex items-center rounded-lg bg-(--error) text-white text-2.5 font-bold hover:opacity-90 transition-all active:scale-95 disabled:opacity-50"
          >
            {busy ? "…" : "Confirm decline"}
          </button>
          <button
            onClick={(e) => { e.preventDefault(); setDeclining(false); setReason(""); }}
            className="h-7 px-2 inline-flex items-center rounded-lg text-secondary/50 text-2.5 font-semibold hover:bg-secondary/10 transition-colors"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

function Lane({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-secondary/5 rounded-xl p-3 flex flex-col gap-2 min-h-40">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-2.5 font-bold uppercase tracking-wide text-secondary/45">{title}</span>
        <span className="text-2.5 font-bold text-secondary/30">{count}</span>
      </div>
      {count === 0 ? (
        <p className="text-2.5 text-secondary/35 text-center py-6">Nothing here</p>
      ) : (
        <div className="flex flex-col gap-2">{children}</div>
      )}
    </div>
  );
}

export default function TransfersListPage() {
  const params = useParams();
  const branchId = typeof params.branchId === "string" ? params.branchId : "";
  const { user, getUserRoleForBranch, isUserOwner } = useAuth();
  const { currentBranch, allBranches } = useBranch();

  const commissary = allBranches.find((b) => b.type === "commissary" && b.id !== branchId);
  const showRequestFromCommissary = !!commissary && currentBranch?.type !== "commissary";

  const isManager = isUserOwner() || getUserRoleForBranch(branchId) === "manager";

  const [loading, setLoading] = useState(true);
  const [transfers, setTransfers] = useState<TransferWithItems[]>([]);

  useEffect(() => {
    if (!branchId) return;
    let cancelled = false;
    setLoading(true);
    getBranchTransfers(branchId).then(({ transfers: t, error }) => {
      if (cancelled) return;
      if (error) console.error("Failed to load transfers", error);
      setTransfers(t);
      setLoading(false);
    });
    const unsub = subscribeToBranchTransfers(branchId, () => {
      getBranchTransfers(branchId).then(({ transfers: t }) => {
        if (!cancelled) setTransfers(t);
      });
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [branchId]);

  // ── Lane computation ────────────────────────────────────────────────────────
  const { requests, inTransit, completed } = useMemo(() => {
    const requests = transfers.filter(
      (t) => t.status === "sent" && t.direction === "pull" && !t.fulfilled_at
    );
    const inTransit = transfers.filter(
      (t) => t.status === "sent" && (t.direction === "push" || !!t.fulfilled_at)
    );
    const completed = transfers
      .filter((t) => t.status === "received" || t.status === "cancelled")
      .slice(0, 30);
    return { requests, inTransit, completed };
  }, [transfers]);

  return (
    <div className="flex flex-col h-full">
      <div className="hidden xl:block">
        <TopBar />
      </div>
      <div className="xl:hidden">
        <MobileTopBar title="Distribution" />
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-5 gap-3">
          <div>
            <h1 className="text-lg font-semibold text-secondary">Distribution</h1>
            <p className="text-xs text-secondary/60">
              Move inventory between {currentBranch?.name ?? "this branch"} and other branches.
            </p>
          </div>
          {isManager && (
            <div className="flex items-center gap-2 shrink-0">
              {showRequestFromCommissary && (
                <Link
                  href={`/${branchId}/transfers/new?mode=pull`}
                  className="h-12 px-4 flex items-center gap-2 rounded-lg shadow-sm font-black text-3 transition-all hover:scale-105 active:scale-95 bg-bundle/10 text-bundle hover:bg-bundle/20"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14m0 0l-5-5m5 5l5-5" />
                  </svg>
                  <span>REQUEST FROM COMMISSARY</span>
                </Link>
              )}
              <Link
                href={`/${branchId}/transfers/new`}
                className="h-12 px-4 flex items-center gap-2 rounded-lg shadow-sm font-black text-3 transition-all hover:scale-105 active:scale-95 bg-accent hover:bg-accent/90"
              >
                <div className="size-4 text-primary drop-shadow-lg">
                  <PlusIcon />
                </div>
                <span className="text-primary text-shadow-md">NEW TRANSFER</span>
              </Link>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2">
            <LoadingSpinner size="md" />
            <p className="text-secondary text-xs">Loading…</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Lane 1 — Requests */}
            <Lane title="Requests" count={requests.length}>
              {requests.map((t) => (
                <KanbanCard
                  key={t.id}
                  t={t}
                  branchId={branchId}
                  isManager={isManager}
                  userId={user?.id}
                />
              ))}
            </Lane>

            {/* Lane 2 — In transit */}
            <Lane title="In transit" count={inTransit.length}>
              {inTransit.map((t) => (
                <KanbanCard
                  key={t.id}
                  t={t}
                  branchId={branchId}
                  isManager={isManager}
                  userId={user?.id}
                />
              ))}
            </Lane>

            {/* Lane 3 — Completed */}
            <Lane title="Completed" count={completed.length}>
              {completed.map((t) => (
                <KanbanCard
                  key={t.id}
                  t={t}
                  branchId={branchId}
                  isManager={isManager}
                  userId={user?.id}
                />
              ))}
            </Lane>
          </div>
        )}

        {!isManager && getUserRoleForBranch(branchId) === "worker" && (
          <p className="mt-3 text-2.5 text-secondary/40">
            You&apos;re viewing as a worker. You can mark incoming transfers received on the detail page, but only managers can confirm or decline.
          </p>
        )}
      </div>
    </div>
  );
}
