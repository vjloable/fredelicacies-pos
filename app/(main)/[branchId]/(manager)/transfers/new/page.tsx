"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useBranch } from "@/contexts/BranchContext";
import {
  subscribeToInventoryItems,
  getAvailableStock,
} from "@/services/inventoryService";
import {
  createPushTransfer,
  createPullRequest,
} from "@/services/transferService";
import {
  getInventoryItems as getItemsForBranch,
} from "@/services/inventoryService";
import type { InventoryItem } from "@/types/domain";
import LoadingSpinner from "@/components/LoadingSpinner";
import TopBar from "@/components/TopBar";
import MobileTopBar from "@/components/MobileTopBar";

type Mode = "push" | "pull";

export default function NewTransferPage() {
  const params = useParams();
  const branchId = typeof params.branchId === "string" ? params.branchId : "";
  const router = useRouter();
  const { user, getUserRoleForBranch, isUserOwner } = useAuth();
  const { availableBranches, currentBranch } = useBranch();

  const role = getUserRoleForBranch(branchId);
  const canManage = isUserOwner() || role === "manager";

  const [mode, setMode] = useState<Mode>("push");
  const [otherBranchId, setOtherBranchId] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [picked, setPicked] = useState<Map<string, number>>(new Map());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sourceItems, setSourceItems] = useState<InventoryItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);

  const sourceBranchId = mode === "push" ? branchId : otherBranchId;
  const destinationBranchId = mode === "push" ? otherBranchId : branchId;

  // Source-branch items: subscribe when push (source is current branch), fetch once when pull (source is other branch).
  useEffect(() => {
    setSourceItems([]);
    setLoadingItems(true);
    setPicked(new Map());

    if (!sourceBranchId) {
      setLoadingItems(false);
      return;
    }

    if (mode === "push") {
      const unsub = subscribeToInventoryItems(sourceBranchId, items => {
        setSourceItems(items);
        setLoadingItems(false);
      });
      return () => {
        unsub?.();
      };
    } else {
      let cancelled = false;
      getItemsForBranch(sourceBranchId).then(({ items }) => {
        if (!cancelled) {
          setSourceItems(items);
          setLoadingItems(false);
        }
      });
      return () => {
        cancelled = true;
      };
    }
  }, [mode, sourceBranchId]);

  const otherBranches = availableBranches.filter(b => b.id !== branchId);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sourceItems
      .filter(i => i.status === "active")
      .filter(i => (q ? i.name.toLowerCase().includes(q) : true))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [sourceItems, search]);

  const updateQty = (itemId: string, qty: number) => {
    setPicked(prev => {
      const next = new Map(prev);
      if (qty <= 0) next.delete(itemId);
      else next.set(itemId, qty);
      return next;
    });
  };

  const totalQty = Array.from(picked.values()).reduce((s, n) => s + n, 0);

  const validationErr = (() => {
    if (!otherBranchId) return "Pick the other branch.";
    if (picked.size === 0) return "Add at least one item.";
    for (const [id, qty] of picked.entries()) {
      const item = sourceItems.find(i => i.id === id);
      if (!item) return `Item ${id} no longer exists.`;
      const max = getAvailableStock(item);
      if (qty > max) return `${item.name}: only ${max} available.`;
      if (qty <= 0) return `${item.name}: invalid quantity.`;
    }
    return null;
  })();

  const handleSubmit = async () => {
    if (!user || validationErr) return;
    setSubmitting(true);
    setError(null);
    try {
      const items = Array.from(picked.entries()).map(([source_item_id, quantity_sent]) => ({
        source_item_id,
        quantity_sent,
      }));

      const fn = mode === "push" ? createPushTransfer : createPullRequest;
      const { id, error } = await fn(user.id, {
        source_branch_id: sourceBranchId,
        destination_branch_id: destinationBranchId,
        note: note.trim() || undefined,
        items,
      });
      if (error || !id) {
        throw error instanceof Error ? error : new Error(String(error?.message ?? "Failed"));
      }
      router.push(`/${branchId}/transfers/${id}`);
    } catch (e: any) {
      setError(e.message ?? "Failed to create transfer");
      setSubmitting(false);
    }
  };

  if (!canManage) {
    return (
      <div className="px-6 py-10 text-center">
        <p className="text-sm text-secondary/60">Only branch managers and the owner can create transfers.</p>
        <Link
          href={`/${branchId}/transfers`}
          className="inline-block mt-3 text-xs text-accent hover:underline">
          ← Back to transfers
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="hidden xl:block">
        <TopBar />
      </div>
      <div className="xl:hidden">
        <MobileTopBar title="New transfer" />
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="flex items-center gap-3 mb-4">
          <Link
            href={`/${branchId}/transfers`}
            className="text-xs text-secondary/60 hover:text-secondary">
            ← Back
          </Link>
        </div>

        <h1 className="text-lg font-semibold text-secondary mb-1">Create transfer</h1>
        <p className="text-xs text-secondary/60 mb-5">
          {mode === "push"
            ? `Ship items from ${currentBranch?.name ?? "this branch"} to another branch.`
            : `Request items from another branch to ${currentBranch?.name ?? "this branch"}.`}
        </p>

        {/* Mode + branch */}
        <div className="bg-white border border-secondary/10 rounded-xl p-4 mb-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-secondary/70 block mb-2">Mode</label>
            <div className="flex gap-2">
              {(["push", "pull"] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium border ${
                    mode === m
                      ? "bg-accent text-primary border-accent"
                      : "bg-white text-secondary border-secondary/20 hover:border-secondary/40"
                  }`}>
                  {m === "push" ? "Send (push)" : "Request (pull)"}
                </button>
              ))}
            </div>
            <p className="mt-1 text-2.5 text-secondary/40">
              {mode === "push"
                ? "We ship now. Source stock is reserved immediately."
                : "We request. Source manager must fulfill before stock moves."}
            </p>
          </div>

          <div>
            <label className="text-xs font-medium text-secondary/70 block mb-2">
              {mode === "push" ? "Destination branch" : "Source branch"}
            </label>
            <select
              value={otherBranchId}
              onChange={e => setOtherBranchId(e.target.value)}
              className="w-full border border-secondary/20 rounded-lg h-9.5 px-3 text-3 focus:outline-none focus:ring-2 focus:ring-accent">
              <option value="">— Select branch —</option>
              {otherBranches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Items picker */}
        <div className="bg-white border border-secondary/10 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <label className="text-xs font-medium text-secondary/70">Items</label>
            <span className="text-2.5 text-secondary/40">
              {picked.size} item{picked.size === 1 ? "" : "s"} • {totalQty} pcs
            </span>
          </div>

          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={
              mode === "push"
                ? "Search this branch's inventory…"
                : sourceBranchId
                ? "Search source branch's inventory…"
                : "Pick a source branch first"
            }
            disabled={mode === "pull" && !sourceBranchId}
            className="w-full border border-secondary/20 rounded-lg h-9.5 px-3 text-3 focus:outline-none focus:ring-2 focus:ring-accent disabled:bg-gray-50 mb-3"
          />

          {loadingItems ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <LoadingSpinner size="md" />
              <p className="text-secondary text-xs">Loading...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <p className="text-xs text-secondary/40 text-center py-6">
              {sourceBranchId ? "No items match." : "Pick a branch first."}
            </p>
          ) : (
            <div className="max-h-80 overflow-y-auto -mx-1">
              {filteredItems.map(item => {
                const available = getAvailableStock(item);
                const qty = picked.get(item.id) ?? 0;
                return (
                  <div
                    key={item.id}
                    className={`mx-1 px-2 py-2 rounded-md border-b border-secondary/5 flex items-center gap-3 ${
                      qty > 0 ? "bg-accent/5" : ""
                    }`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-secondary truncate">{item.name}</p>
                      <p className="text-2.5 text-secondary/50">
                        Available: <span className="tabular-nums">{available}</span>
                        {item.reserved_stock > 0 && (
                          <span className="ml-1 text-secondary/30">
                            ({item.reserved_stock} reserved)
                          </span>
                        )}
                      </p>
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={available}
                      value={qty || ""}
                      onChange={e => {
                        const n = parseInt(e.target.value || "0", 10);
                        if (!Number.isFinite(n)) return;
                        updateQty(item.id, Math.min(Math.max(0, n), available));
                      }}
                      placeholder="0"
                      className="w-20 text-right border border-secondary/20 rounded-lg h-9.5 px-2 text-3 focus:outline-none focus:ring-2 focus:ring-accent shrink-0"
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Note */}
        <div className="bg-white border border-secondary/10 rounded-xl p-4 mb-4">
          <label className="text-xs font-medium text-secondary/70 block mb-2">
            Note <span className="text-secondary/40">(optional)</span>
          </label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Anything the other branch should know…"
            rows={2}
            className="w-full border border-secondary/20 rounded-lg px-3 py-2 text-3 focus:outline-none focus:ring-2 focus:ring-accent resize-none"
          />
        </div>

        {(error || validationErr) && (
          <div className="bg-error/10 border border-error/20 text-error text-2.5 px-3 py-2 rounded-lg mb-3">
            {error || validationErr}
          </div>
        )}

        <div className="flex gap-3">
          <Link
            href={`/${branchId}/transfers`}
            className="flex-1 px-4 py-3 text-center text-xs text-secondary/80 bg-white border border-secondary/20 rounded-lg hover:bg-gray-50 transition-colors font-semibold">
            Cancel
          </Link>
          <button
            onClick={handleSubmit}
            disabled={submitting || !!validationErr}
            className={`flex-1 px-4 py-3 rounded-lg text-xs font-semibold transition-all ${
              submitting || validationErr
                ? "bg-gray-100 text-secondary/50 cursor-not-allowed"
                : "bg-accent text-primary hover:bg-accent/90"
            }`}>
            {submitting ? "Creating..." : mode === "push" ? "Send transfer" : "Submit request"}
          </button>
        </div>
      </div>
    </div>
  );
}
