"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useBranch } from "@/contexts/BranchContext";
import {
  cancelTransfer,
  createItemFromSnapshot,
  fulfillPullRequest,
  getTransferById,
  matchDestinationItem,
  receiveTransfer,
} from "@/services/transferService";
import type { TransferWithItems, SettleLineCount } from "@/types/domain/transfer";
import LoadingSpinner from "@/components/LoadingSpinner";
import TopBar from "@/components/TopBar";
import MobileTopBar from "@/components/MobileTopBar";

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
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

export default function TransferDetailPage() {
  const params = useParams();
  const branchId = typeof params.branchId === "string" ? params.branchId : "";
  const transferId = typeof params.id === "string" ? params.id : "";
  const { getUserRoleForBranch, isUserOwner } = useAuth();
  const { availableBranches } = useBranch();

  const [loading, setLoading] = useState(true);
  const [transfer, setTransfer] = useState<TransferWithItems | null>(null);
  const [reload, setReload] = useState(0);

  const [showReceive, setShowReceive] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [showFulfill, setShowFulfill] = useState(false);

  useEffect(() => {
    if (!transferId) return;
    let cancelled = false;
    setLoading(true);
    getTransferById(transferId).then(({ transfer, error }) => {
      if (cancelled) return;
      if (error) console.error(error);
      setTransfer(transfer);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [transferId, reload]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2">
        <LoadingSpinner size="md" />
        <p className="text-secondary text-xs">Loading...</p>
      </div>
    );
  }

  if (!transfer) {
    return (
      <div className="px-6 py-10 text-center text-sm text-secondary/60">
        Transfer not found.
        <div className="mt-3">
          <Link href={`/${branchId}/transfers`} className="text-accent text-xs hover:underline">
            ← Back to transfers
          </Link>
        </div>
      </div>
    );
  }

  const owner = isUserOwner();
  const role = getUserRoleForBranch(branchId);
  const isManagerHere = owner || role === "manager";
  const isAtSource = branchId === transfer.source_branch_id;
  const isAtDest = branchId === transfer.destination_branch_id;
  const sourceManagerByOwner = owner;
  const destManagerByOwner = owner;
  const canFulfill =
    transfer.status === "sent" &&
    transfer.direction === "pull" &&
    !transfer.fulfilled_at &&
    isAtSource &&
    (isManagerHere || sourceManagerByOwner);
  const canReceive =
    transfer.status === "sent" &&
    isAtDest &&
    (transfer.direction === "push" || !!transfer.fulfilled_at) &&
    (isManagerHere || role === "worker" || destManagerByOwner);
  const canCancel =
    transfer.status === "sent" &&
    (owner || (isManagerHere && (isAtSource || isAtDest)));

  const ux = uxLabel(transfer);

  const handleFulfill = () => setShowFulfill(true);

  return (
    <div className="flex flex-col h-full">
      <div className="hidden xl:block">
        <TopBar />
      </div>
      <div className="xl:hidden">
        <MobileTopBar title={transfer.transfer_number} />
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        <Link href={`/${branchId}/transfers`} className="text-xs text-secondary/60 hover:text-secondary">
          ← Back
        </Link>

        <div className="mt-3 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg font-semibold text-secondary">{transfer.transfer_number}</h1>
            <p className="text-xs text-secondary/60 mt-0.5">
              {transfer.source_branch_name} <span className="text-secondary/30 mx-1.5">→</span>
              {transfer.destination_branch_name}
              <span className="ml-2 text-2.5 text-secondary/40 capitalize">({transfer.direction})</span>
            </p>
          </div>
          <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${ux.color}`}>
            {ux.label}
          </span>
        </div>

        {/* Meta grid */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 bg-white border border-secondary/10 rounded-xl p-4">
          <Meta label="Created" value={formatDate(transfer.created_at)} subtitle={transfer.created_by_name} />
          <Meta label="Fulfilled" value={formatDate(transfer.fulfilled_at)} />
          <Meta label="Received" value={formatDate(transfer.received_at)} />
          <Meta
            label={transfer.status === "cancelled" ? "Cancelled" : "Updated"}
            value={
              transfer.status === "cancelled"
                ? formatDate(transfer.cancelled_at)
                : formatDate(transfer.updated_at)
            }
            subtitle={transfer.cancel_reason ?? undefined}
          />
        </div>

        {transfer.note && (
          <div className="mt-3 bg-white border border-secondary/10 rounded-xl p-4">
            <p className="text-2.5 uppercase tracking-wide text-secondary/40 mb-1">Note</p>
            <p className="text-xs text-secondary/80 whitespace-pre-wrap">{transfer.note}</p>
          </div>
        )}

        {/* Items */}
        <div className="mt-4 bg-white border border-secondary/10 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-secondary/5">
              <tr className="text-2.5 text-secondary/60 uppercase tracking-wide">
                <th className="text-left px-4 py-2 font-medium">Item</th>
                <th className="text-right px-4 py-2 font-medium">Sent</th>
                <th className="text-right px-4 py-2 font-medium">Received</th>
                <th className="text-right px-4 py-2 font-medium">Discrepancy</th>
              </tr>
            </thead>
            <tbody>
              {transfer.items.map(line => {
                const diff =
                  line.quantity_received !== null
                    ? line.quantity_sent - line.quantity_received
                    : null;
                return (
                  <tr key={line.id} className="border-t border-secondary/10 text-xs">
                    <td className="px-4 py-3">
                      <div className="font-medium text-secondary">{line.item_name}</div>
                      {line.category_names && line.category_names.length > 0 && (
                        <div className="text-2.5 text-secondary/40 mt-0.5">
                          {line.category_names.join(" · ")}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{line.quantity_sent}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {line.quantity_received ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {diff === null ? "—" : diff === 0 ? <span className="text-secondary/40">0</span> : (
                        <span className="text-error font-semibold">−{diff}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Action buttons */}
        <div className="mt-4 flex flex-wrap gap-2">
          {canFulfill && (
            <button
              onClick={handleFulfill}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-accent text-primary hover:bg-accent/90">
              Fulfill request
            </button>
          )}
          {canReceive && (
            <button
              onClick={() => setShowReceive(true)}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-accent text-primary hover:bg-accent/90">
              Receive shipment
            </button>
          )}
          {canCancel && (
            <button
              onClick={() => setShowCancel(true)}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-error/10 text-error hover:bg-error/20">
              Cancel
            </button>
          )}
        </div>

        {!availableBranches.length && (
          <p className="mt-3 text-2.5 text-secondary/40">Branch list still loading…</p>
        )}
      </div>

      {showFulfill && transfer && (
        <FulfillRequestModal
          transfer={transfer}
          onClose={() => setShowFulfill(false)}
          onDone={() => {
            setShowFulfill(false);
            setReload(x => x + 1);
          }}
        />
      )}

      {showReceive && (
        <ReceiveShipmentModal
          transfer={transfer}
          onClose={() => setShowReceive(false)}
          onDone={() => {
            setShowReceive(false);
            setReload(x => x + 1);
          }}
        />
      )}

      {showCancel && (
        <CancelTransferModal
          transfer={transfer}
          onClose={() => setShowCancel(false)}
          onDone={() => {
            setShowCancel(false);
            setReload(x => x + 1);
          }}
        />
      )}
    </div>
  );
}

function Meta({ label, value, subtitle }: { label: string; value: string; subtitle?: string }) {
  return (
    <div>
      <p className="text-2.5 uppercase tracking-wide text-secondary/40">{label}</p>
      <p className="text-xs text-secondary mt-0.5 tabular-nums">{value}</p>
      {subtitle && <p className="text-2.5 text-secondary/50 mt-0.5">{subtitle}</p>}
    </div>
  );
}

// ─── Receive modal ──────────────────────────────────────────────────────────
function ReceiveShipmentModal({
  transfer,
  onClose,
  onDone,
}: {
  transfer: TransferWithItems;
  onClose: () => void;
  onDone: () => void;
}) {
  const { user } = useAuth();
  const [counts, setCounts] = useState<Record<string, number>>(
    Object.fromEntries(transfer.items.map(it => [it.id, it.quantity_sent]))
  );
  const [destItemIds, setDestItemIds] = useState<Record<string, string | null>>({});
  const [matching, setMatching] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resolve a dest item for each line by case-insensitive name match.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const results: Record<string, string | null> = {};
      await Promise.all(
        transfer.items.map(async line => {
          if (line.destination_item_id) {
            results[line.id] = line.destination_item_id;
            return;
          }
          const match = await matchDestinationItem(transfer.destination_branch_id, line.item_name);
          results[line.id] = match?.id ?? null;
        })
      );
      if (!cancelled) {
        setDestItemIds(results);
        setMatching(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [transfer]);

  const unresolved = transfer.items.filter(line => !destItemIds[line.id]);
  const [adding, setAdding] = useState<string | null>(null);

  const handleAddToCatalog = async (lineId: string) => {
    const line = transfer.items.find(l => l.id === lineId);
    if (!line) return;
    setAdding(lineId);
    setError(null);
    const { id, error } = await createItemFromSnapshot(transfer.destination_branch_id, {
      name: line.item_name,
      cost: line.item_cost,
      price: line.item_price,
      category_names: line.category_names ?? [],
    });
    setAdding(null);
    if (error || !id) {
      setError(`Failed to add "${line.item_name}" to catalog: ${error?.message ?? "unknown"}`);
      return;
    }
    setDestItemIds(prev => ({ ...prev, [lineId]: id }));
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (unresolved.length > 0) {
      setError(
        `${unresolved.length} item${unresolved.length === 1 ? "" : "s"} still need to be added to this branch's catalog before receiving.`
      );
      return;
    }
    setBusy(true);
    setError(null);

    const lineCounts: SettleLineCount[] = transfer.items.map(line => ({
      transfer_item_id: line.id,
      quantity_received: counts[line.id] ?? 0,
      destination_item_id: destItemIds[line.id]!,
    }));

    const { error } = await receiveTransfer(user.id, transfer.id, lineCounts);
    setBusy(false);
    if (error) {
      setError(error.message ?? String(error));
      return;
    }
    onDone();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[85dvh] overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-secondary/10 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-secondary">Receive shipment</h2>
            <p className="text-2.5 text-secondary/50 mt-0.5">
              Enter counts for each line. Defaults to the sent amount.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-secondary/50 text-lg hover:text-secondary"
            aria-label="Close">
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {matching ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <LoadingSpinner size="md" />
              <p className="text-secondary text-xs">Matching catalog…</p>
            </div>
          ) : (
            transfer.items.map(line => {
              const matched = !!destItemIds[line.id];
              const isAdding = adding === line.id;
              return (
                <div
                  key={line.id}
                  className={`border rounded-lg p-3 ${
                    matched ? "border-secondary/15" : "border-amber-300 bg-amber-50/40"
                  }`}>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-secondary">{line.item_name}</p>
                      {matched ? (
                        <p className="text-2.5 text-success mt-0.5">Matched dest catalog</p>
                      ) : (
                        <p className="text-2.5 text-amber-700 mt-0.5">
                          Not in this branch's catalog yet
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-2.5 text-secondary/40">of {line.quantity_sent}</span>
                      <input
                        type="number"
                        min={0}
                        max={line.quantity_sent}
                        value={counts[line.id] ?? 0}
                        onChange={e => {
                          const n = parseInt(e.target.value || "0", 10);
                          if (!Number.isFinite(n)) return;
                          setCounts(c => ({
                            ...c,
                            [line.id]: Math.max(0, Math.min(line.quantity_sent, n)),
                          }));
                        }}
                        disabled={!matched}
                        className="w-20 text-right border border-secondary/20 rounded-lg h-9.5 px-2 text-3 focus:outline-none focus:ring-2 focus:ring-accent disabled:bg-gray-50 disabled:text-secondary/40"
                      />
                    </div>
                  </div>
                  {!matched && (
                    <div className="mt-2 pt-2 border-t border-amber-200/60 flex items-center justify-between gap-2">
                      <p className="text-2.5 text-secondary/60 flex-1 min-w-0">
                        Add it as new — name, price{line.item_cost != null ? ", cost" : ""}
                        {line.category_names && line.category_names.length > 0
                          ? `, ${line.category_names.length} categor${line.category_names.length === 1 ? "y" : "ies"}`
                          : ""}{" "}
                        will be copied from the source.
                      </p>
                      <button
                        type="button"
                        onClick={() => handleAddToCatalog(line.id)}
                        disabled={isAdding}
                        className={`px-3 py-1.5 rounded-md text-2.5 font-semibold shrink-0 ${
                          isAdding
                            ? "bg-gray-100 text-secondary/50 cursor-not-allowed"
                            : "bg-accent/15 text-accent hover:bg-accent/25"
                        }`}>
                        {isAdding ? "Adding..." : "Add to catalog"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
          {error && (
            <div className="bg-error/10 border border-error/20 text-error text-2.5 px-3 py-2 rounded-lg">
              {error}
            </div>
          )}
        </div>
        <div className="px-5 py-4 border-t border-secondary/10 bg-gray-50 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-xs text-secondary/80 bg-white border border-secondary/20 rounded-lg hover:bg-gray-50 font-semibold">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={busy || matching}
            className={`flex-1 px-4 py-2.5 rounded-lg text-xs font-semibold ${
              busy || matching
                ? "bg-gray-100 text-secondary/50 cursor-not-allowed"
                : "bg-accent text-primary hover:bg-accent/90"
            }`}>
            {busy ? "Saving..." : "Confirm receive"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Fulfill modal ──────────────────────────────────────────────────────────
function FulfillRequestModal({
  transfer,
  onClose,
  onDone,
}: {
  transfer: TransferWithItems;
  onClose: () => void;
  onDone: () => void;
}) {
  const { user } = useAuth();
  const [qtys, setQtys] = useState<Record<string, number>>(
    Object.fromEntries(transfer.items.map(it => [it.id, it.quantity_sent]))
  );
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPartial = transfer.items.some(it => qtys[it.id] < it.quantity_sent);
  const noteRequired = isPartial && !note.trim();
  const allZero = transfer.items.every(it => (qtys[it.id] ?? 0) === 0);

  const handleSubmit = async () => {
    if (!user) return;
    if (noteRequired) {
      setError("Please add a note explaining the partial fulfillment.");
      return;
    }
    if (allZero) {
      setError("All lines are 0. Use Decline instead to reject the request.");
      return;
    }
    setBusy(true);
    setError(null);
    const adjustments = transfer.items
      .filter(it => qtys[it.id] !== it.quantity_sent)
      .map(it => ({ transfer_item_id: it.id, quantity: qtys[it.id] ?? 0 }));
    const { error } = await fulfillPullRequest(user.id, transfer.id, {
      adjustments: adjustments.length ? adjustments : undefined,
      note: note.trim() || undefined,
    });
    setBusy(false);
    if (error) {
      setError(error.message ?? String(error));
      return;
    }
    onDone();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[85dvh] overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-secondary/10 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-secondary">Fulfill request</h2>
            <p className="text-2.5 text-secondary/50 mt-0.5">
              Adjust quantities if you can only send a partial amount. A note is required for any reduction.
            </p>
          </div>
          <button onClick={onClose} className="text-secondary/50 text-lg hover:text-secondary" aria-label="Close">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {transfer.items.map(line => {
            const qty = qtys[line.id] ?? 0;
            const reduced = qty < line.quantity_sent;
            return (
              <div key={line.id} className={`border rounded-lg p-3 ${reduced ? "border-amber-300 bg-amber-50/40" : "border-secondary/15"}`}>
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-secondary">{line.item_name}</p>
                    <p className="text-2.5 text-secondary/40 mt-0.5">
                      Requested: {line.quantity_sent} pcs
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setQtys(q => ({ ...q, [line.id]: Math.max(0, (q[line.id] ?? 0) - 1) }))}
                      className="size-7 flex items-center justify-center rounded-lg border border-secondary/20 text-secondary hover:bg-secondary/10 font-bold text-sm"
                    >−</button>
                    <input
                      type="number"
                      min={0}
                      max={line.quantity_sent}
                      value={qty}
                      onChange={e => {
                        const n = parseInt(e.target.value || "0", 10);
                        if (!Number.isFinite(n)) return;
                        setQtys(q => ({ ...q, [line.id]: Math.max(0, Math.min(line.quantity_sent, n)) }));
                      }}
                      className="w-16 text-center border border-secondary/20 rounded-lg h-9 px-2 text-3 focus:outline-none focus:ring-2 focus:ring-accent [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <button
                      type="button"
                      onClick={() => setQtys(q => ({ ...q, [line.id]: Math.min(line.quantity_sent, (q[line.id] ?? 0) + 1) }))}
                      className="size-7 flex items-center justify-center rounded-lg border border-secondary/20 text-secondary hover:bg-secondary/10 font-bold text-sm"
                    >+</button>
                  </div>
                </div>
                {reduced && qty > 0 && (
                  <p className="text-2.5 text-amber-700 mt-1.5">Will send {qty} of {line.quantity_sent} requested</p>
                )}
                {qty === 0 && (
                  <p className="text-2.5 text-(--error) mt-1.5">This line will be removed</p>
                )}
              </div>
            );
          })}

          <div>
            <label className="text-2.5 text-secondary/70 block mb-1.5">
              Note {isPartial ? <span className="text-(--error)">*</span> : <span className="text-secondary/40">(optional)</span>}
            </label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              placeholder={isPartial ? "Explain why quantities were adjusted…" : "e.g. packed and ready"}
              className="w-full border border-secondary/20 rounded-lg px-3 py-2 text-3 focus:outline-none focus:ring-2 focus:ring-accent resize-none"
            />
          </div>

          {error && (
            <div className="bg-(--error)/10 border border-(--error)/20 text-(--error) text-2.5 px-3 py-2 rounded-lg">
              {error}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-secondary/10 bg-gray-50 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-xs text-secondary/80 bg-white border border-secondary/20 rounded-lg hover:bg-gray-50 font-semibold">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={busy}
            className={`flex-1 px-4 py-2.5 rounded-lg text-xs font-semibold ${
              busy ? "bg-gray-100 text-secondary/50 cursor-not-allowed" : "bg-accent text-primary hover:bg-accent/90"
            }`}>
            {busy ? "Fulfilling..." : isPartial ? "Fulfill (partial)" : "Fulfill request"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Cancel modal ───────────────────────────────────────────────────────────
function CancelTransferModal({
  transfer,
  onClose,
  onDone,
}: {
  transfer: TransferWithItems;
  onClose: () => void;
  onDone: () => void;
}) {
  const { user } = useAuth();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!user) return;
    setBusy(true);
    setError(null);
    const { error } = await cancelTransfer(user.id, transfer.id, reason);
    setBusy(false);
    if (error) {
      setError(error.message ?? String(error));
      return;
    }
    onDone();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-secondary/10">
          <h2 className="text-sm font-semibold text-secondary">Cancel transfer?</h2>
          <p className="text-2.5 text-secondary/60 mt-0.5">
            This releases reserved stock at the source if any was placed. Cannot be undone.
          </p>
        </div>
        <div className="p-5 space-y-3">
          <label className="text-2.5 text-secondary/70 block">
            Reason <span className="text-secondary/40">(optional)</span>
          </label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={2}
            placeholder="e.g. wrong items selected"
            className="w-full border border-secondary/20 rounded-lg px-3 py-2 text-3 focus:outline-none focus:ring-2 focus:ring-accent resize-none"
          />
          {error && (
            <div className="bg-error/10 border border-error/20 text-error text-2.5 px-3 py-2 rounded-lg">
              {error}
            </div>
          )}
        </div>
        <div className="px-5 py-4 border-t border-secondary/10 bg-gray-50 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-xs text-secondary/80 bg-white border border-secondary/20 rounded-lg hover:bg-gray-50 font-semibold">
            Keep
          </button>
          <button
            onClick={handleSubmit}
            disabled={busy}
            className={`flex-1 px-4 py-2.5 rounded-lg text-xs font-semibold ${
              busy
                ? "bg-gray-100 text-secondary/50 cursor-not-allowed"
                : "bg-error/10 text-error hover:bg-error/20"
            }`}>
            {busy ? "Cancelling..." : "Cancel transfer"}
          </button>
        </div>
      </div>
    </div>
  );
}
