"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
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
import { getCategories } from "@/services/categoryService";
import type { InventoryItem, Category } from "@/types/domain";
import LoadingSpinner from "@/components/LoadingSpinner";
import TopBar from "@/components/TopBar";
import MobileTopBar from "@/components/MobileTopBar";

type Mode = "push" | "pull";

// Touch-friendly item row for the kiosk picker: tap anywhere to choose a quantity.
function ItemRow({
  item,
  qty,
  showStock,
  onPick,
}: {
  item: InventoryItem;
  qty: number;
  showStock: boolean;
  onPick: () => void;
}) {
  const available = getAvailableStock(item);
  const outOfStock = showStock && available === 0;
  return (
    <button
      onClick={outOfStock ? undefined : onPick}
      disabled={outOfStock}
      className={`w-full mx-1 my-0.5 px-2 py-2.5 rounded-lg border border-transparent flex items-center gap-3 text-left transition-colors ${
        outOfStock
          ? "opacity-40 cursor-not-allowed"
          : qty > 0
          ? "bg-accent/5 border-accent/20"
          : "hover:bg-secondary/5"
      }`}>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-secondary truncate">{item.name}</p>
        {showStock && (
          <p className="text-2.5 text-secondary/50">
            {outOfStock ? (
              <span className="text-(--error)">Out of stock</span>
            ) : (
              <>
                Available: <span className="tabular-nums">{available}</span>
                {item.reserved_stock > 0 && (
                  <span className="ml-1 text-secondary/30">({item.reserved_stock} reserved)</span>
                )}
              </>
            )}
          </p>
        )}
      </div>
      {qty > 0 ? (
        <span className="h-7 min-w-7 px-2 shrink-0 inline-flex items-center justify-center rounded-lg bg-accent text-primary text-2.5 font-bold tabular-nums">
          {qty}
        </span>
      ) : outOfStock ? (
        <span className="h-7 px-2.5 shrink-0 inline-flex items-center rounded-lg bg-secondary/5 text-secondary/40 text-2.5 font-bold">
          Out of stock
        </span>
      ) : (
        <span className="h-7 px-2.5 shrink-0 inline-flex items-center rounded-lg bg-secondary/10 text-secondary text-2.5 font-bold">
          Add
        </span>
      )}
    </button>
  );
}

function NewTransferPageInner() {
  const params = useParams();
  const branchId = typeof params.branchId === "string" ? params.branchId : "";
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, getUserRoleForBranch, isUserOwner } = useAuth();
  const { allBranches, currentBranch } = useBranch();

  const role = getUserRoleForBranch(branchId);
  const canManage = isUserOwner() || role === "manager";

  const queryMode = searchParams.get("mode");
  const [mode, setMode] = useState<Mode>(queryMode === "pull" || queryMode === "push" ? queryMode : "push");

  // Default the direction by branch type once the branch resolves (unless the URL set it):
  // the commissary ships out (push); regular/event branches request in (pull).
  const modeInitialized = useRef(false);
  useEffect(() => {
    if (modeInitialized.current || !currentBranch) return;
    modeInitialized.current = true;
    // The commissary is push-only, whatever the URL asked for.
    if (currentBranch.type === "commissary") {
      setMode("push");
      return;
    }
    if (queryMode === "pull" || queryMode === "push") return;
    setMode("pull");
  }, [currentBranch, queryMode]);
  const [otherBranchId, setOtherBranchId] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [picked, setPicked] = useState<Map<string, number>>(new Map());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sourceItems, setSourceItems] = useState<InventoryItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);

  // Kiosk drill-down state: categories of the source branch + which folder is open.
  const [sourceCategories, setSourceCategories] = useState<Category[]>([]);
  const [pickerCategoryId, setPickerCategoryId] = useState<string | null>(null);
  // Item pending a quantity choice (opens the quantity sheet).
  const [qtyItem, setQtyItem] = useState<InventoryItem | null>(null);
  const [qtyDraft, setQtyDraft] = useState<string>("");
  const UNCAT = "__uncat__";

  // Wizard: 1 = branch, 2 = items, 3 = review.
  const [step, setStep] = useState(1);
  const STEPS = ["Branch", "Items", "Review"];
  // The commissary sends (push); every other branch requests (pull). No toggle needed.
  const isSend = mode === "push";

  const sourceBranchId = mode === "push" ? branchId : otherBranchId;
  const destinationBranchId = mode === "push" ? otherBranchId : branchId;

  // Source-branch items: subscribe when push (source is current branch), fetch once when pull (source is other branch).
  useEffect(() => {
    setSourceItems([]);
    setLoadingItems(true);
    setPicked(new Map());
    setPickerCategoryId(null);
    setSearch("");

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

  // Load the source branch's categories so the picker can group items into folders.
  useEffect(() => {
    setSourceCategories([]);
    if (!sourceBranchId) return;
    let cancelled = false;
    getCategories(sourceBranchId).then(({ categories }) => {
      if (!cancelled) setSourceCategories(categories ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [sourceBranchId]);

  // Counterparts come from ALL branches, not just the user's assigned ones — a manager
  // ships to / requests from branches they don't belong to. The commissary only sends, so
  // it's never a valid push destination.
  const otherBranches = allBranches.filter(b => {
    if (b.id === branchId) return false;
    if (mode === 'push' && b.type === 'commissary') return false;
    return true;
  });

  // Clear a stale counterpart when a mode switch drops it from the valid list.
  useEffect(() => {
    if (otherBranchId && !otherBranches.some(b => b.id === otherBranchId)) {
      setOtherBranchId("");
    }
  }, [otherBranches, otherBranchId]);

  // On a pull, default the source to the Commissary (the production/distribution hub) when present.
  useEffect(() => {
    if (otherBranchId || mode !== 'pull') return;
    const commissary = otherBranches.find(b => b.type === 'commissary');
    if (commissary) setOtherBranchId(commissary.id);
  }, [otherBranches, otherBranchId, mode]);

  const activeItems = useMemo(
    () => sourceItems.filter(i => i.status === "active"),
    [sourceItems]
  );

  // An item belongs to a category via the multi-category junction when present, else its
  // single category_id. UNCAT collects items with no category at all.
  const itemInCategory = (item: InventoryItem, catId: string) => {
    if (catId === UNCAT) {
      return item.category_ids && item.category_ids.length > 0
        ? false
        : !item.category_id;
    }
    if (item.category_ids && item.category_ids.length > 0) return item.category_ids.includes(catId);
    return item.category_id === catId;
  };

  // Folder grid: only categories that actually contain items, plus an Uncategorized folder.
  const categoryFolders = useMemo(() => {
    const folders = sourceCategories
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(c => ({
        id: c.id,
        name: c.name,
        color: c.color?.trim() || "#6B7280",
        count: activeItems.filter(i => itemInCategory(i, c.id)).length,
      }))
      .filter(f => f.count > 0);
    const uncatCount = activeItems.filter(i => itemInCategory(i, UNCAT)).length;
    if (uncatCount > 0) {
      folders.push({ id: UNCAT, name: "Uncategorized", color: "#9CA3AF", count: uncatCount });
    }
    return folders;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceCategories, activeItems]);

  const folderItems = useMemo(() => {
    if (pickerCategoryId === null) return [];
    return activeItems
      .filter(i => itemInCategory(i, pickerCategoryId))
      .sort((a, b) => a.name.localeCompare(b.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeItems, pickerCategoryId]);

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return activeItems
      .filter(i => i.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [activeItems, search]);

  const activeFolderName =
    pickerCategoryId === UNCAT
      ? "Uncategorized"
      : sourceCategories.find(c => c.id === pickerCategoryId)?.name ?? "Category";

  const updateQty = (itemId: string, qty: number) => {
    setPicked(prev => {
      const next = new Map(prev);
      if (qty <= 0) next.delete(itemId);
      else next.set(itemId, qty);
      return next;
    });
  };

  // Requested-items list (below the picker), preserving insertion order.
  const pickedList = Array.from(picked.entries())
    .map(([id, qty]) => ({ item: sourceItems.find(i => i.id === id), qty }))
    .filter((x): x is { item: InventoryItem; qty: number } => !!x.item);

  const openQty = (item: InventoryItem) => {
    setQtyItem(item);
    setQtyDraft(String(picked.get(item.id) ?? 1));
  };
  const closeQty = () => {
    setQtyItem(null);
    setQtyDraft("");
  };
  const confirmQty = () => {
    if (!qtyItem) return;
    // Send reserves stock immediately, so it's capped at what's available. A request just
    // asks the source to supply, so any positive amount is allowed.
    const parsed = Math.max(0, parseInt(qtyDraft || "0", 10) || 0);
    const n = isSend ? Math.min(parsed, getAvailableStock(qtyItem)) : parsed;
    updateQty(qtyItem.id, n);
    closeQty();
  };

  const totalQty = Array.from(picked.values()).reduce((s, n) => s + n, 0);

  const otherBranchName = otherBranches.find(b => b.id === otherBranchId)?.name;
  // Stock only constrains a send; a request can exceed current stock.
  const overStock = isSend && pickedList.some(({ item, qty }) => qty > getAvailableStock(item));
  const canAdvance =
    step === 1 ? !!otherBranchId : step === 2 ? picked.size > 0 && !overStock : true;

  const validationErr = (() => {
    if (!otherBranchId) return "Pick the other branch.";
    if (picked.size === 0) return "Add at least one item.";
    for (const [id, qty] of picked.entries()) {
      const item = sourceItems.find(i => i.id === id);
      if (!item) return `Item ${id} no longer exists.`;
      if (isSend && qty > getAvailableStock(item)) return `${item.name}: only ${getAvailableStock(item)} available.`;
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

        <h1 className="text-lg font-semibold text-secondary mb-1">
          {isSend ? "Send transfer" : "Request transfer"}
        </h1>
        <p className="text-xs text-secondary/60 mb-4">
          {isSend
            ? `Ship items from ${currentBranch?.name ?? "this branch"} to another branch.`
            : `Request items from another branch to ${currentBranch?.name ?? "this branch"}.`}
        </p>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-5">
          {STEPS.map((label, i) => {
            const n = i + 1;
            const active = step === n;
            const done = step > n;
            return (
              <div key={label} className="flex items-center gap-2">
                <div className={`flex items-center gap-1.5 ${active || done ? "text-accent" : "text-secondary/40"}`}>
                  <span className={`h-6 w-6 rounded-full flex items-center justify-center text-2.5 font-bold ${
                    active ? "bg-accent text-primary" : done ? "bg-accent/20 text-accent" : "bg-secondary/10 text-secondary/40"
                  }`}>
                    {done ? "✓" : n}
                  </span>
                  <span className="text-2.5 font-semibold hidden sm:inline">{label}</span>
                </div>
                {n < STEPS.length && <span className="w-4 h-px bg-secondary/20" />}
              </div>
            );
          })}
        </div>

        {/* STEP 1 — pick the branch */}
        {step === 1 && (
          <div className="bg-white border border-secondary/10 rounded-xl p-4 mb-4">
            <label className="text-xs font-medium text-secondary/70 block mb-2">
              {isSend ? "Destination branch" : "Source branch"}
            </label>
            <select
              value={otherBranchId}
              onChange={e => setOtherBranchId(e.target.value)}
              className="w-full border border-secondary/20 rounded-lg h-10 px-3 text-3 focus:outline-none focus:ring-2 focus:ring-accent">
              <option value="">— Select branch —</option>
              {otherBranches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <p className="mt-2 text-2.5 text-secondary/40">
              {isSend
                ? "We ship now. Source stock is reserved immediately."
                : "We request. The source manager must fulfil before stock moves."}
            </p>
          </div>
        )}

        {/* STEP 2 — pick items */}
        {step === 2 && (
          <>
        {/* Items picker — kiosk drill-down (categories → items → quantity) */}
        <div className="bg-white border border-secondary/10 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <label className="text-xs font-medium text-secondary/70">Items</label>
            <span className="text-2.5 text-secondary/40">
              {picked.size} item{picked.size === 1 ? "" : "s"} • {totalQty} pcs
            </span>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-secondary/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={sourceBranchId ? "Search any item…" : "Pick a branch first"}
              disabled={mode === "pull" && !sourceBranchId}
              className="w-full border border-secondary/20 rounded-lg h-10 pl-9 pr-3 text-3 focus:outline-none focus:ring-2 focus:ring-accent disabled:bg-gray-50"
            />
          </div>

          {loadingItems ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <LoadingSpinner size="md" />
              <p className="text-secondary text-xs">Loading...</p>
            </div>
          ) : !sourceBranchId ? (
            <p className="text-xs text-secondary/40 text-center py-6">Pick a branch first.</p>
          ) : search.trim() ? (
            /* Search results — flat, across all categories */
            searchResults.length === 0 ? (
              <p className="text-xs text-secondary/40 text-center py-6">No items match.</p>
            ) : (
              <div className="max-h-80 overflow-y-auto -mx-1">
                {searchResults.map(item => (
                  <ItemRow key={item.id} item={item} qty={picked.get(item.id) ?? 0} showStock={isSend} onPick={() => openQty(item)} />
                ))}
              </div>
            )
          ) : pickerCategoryId === null ? (
            /* Category folder grid */
            categoryFolders.length === 0 ? (
              <p className="text-xs text-secondary/40 text-center py-6">No items to transfer.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {categoryFolders.map(f => (
                  <button
                    key={f.id}
                    onClick={() => setPickerCategoryId(f.id)}
                    className="group flex flex-col items-start gap-2 p-3 rounded-lg border border-secondary/10 hover:border-accent hover:shadow-sm transition-all active:scale-95 text-left">
                    <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${f.color}20`, color: f.color }}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                      </svg>
                    </span>
                    <span className="min-w-0 w-full">
                      <span className="block text-xs font-semibold text-secondary truncate">{f.name}</span>
                      <span className="block text-2.5 text-secondary/40">{f.count} item{f.count === 1 ? "" : "s"}</span>
                    </span>
                  </button>
                ))}
              </div>
            )
          ) : (
            /* Inside a folder: breadcrumb + item list */
            <>
              <div className="flex items-center gap-2 mb-2 text-2.5">
                <button onClick={() => setPickerCategoryId(null)} className="flex items-center gap-1 text-accent font-semibold hover:underline">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  All items
                </button>
                <span className="text-secondary/30">/</span>
                <span className="font-semibold text-secondary truncate">{activeFolderName}</span>
              </div>
              {folderItems.length === 0 ? (
                <p className="text-xs text-secondary/40 text-center py-6">No items in this category.</p>
              ) : (
                <div className="max-h-80 overflow-y-auto -mx-1">
                  {folderItems.map(item => (
                    <ItemRow key={item.id} item={item} qty={picked.get(item.id) ?? 0} showStock={isSend} onPick={() => openQty(item)} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Requested items — the running list below the picker */}
        {pickedList.length > 0 && (
          <div className="bg-white border border-secondary/10 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <label className="text-xs font-medium text-secondary/70">
                {mode === "push" ? "Items to send" : "Requested items"}
              </label>
              <span className="text-2.5 text-secondary/40">{totalQty} pcs</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {pickedList.map(({ item, qty }) => {
                const available = getAvailableStock(item);
                const over = isSend && qty > available;
                return (
                  <div key={item.id} className="flex items-center gap-3 px-2 py-2 rounded-lg bg-accent/5 border border-accent/10">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-secondary truncate">{item.name}</p>
                      <p className={`text-2.5 ${over ? "text-error" : "text-secondary/50"}`}>
                        <span className="tabular-nums font-semibold">{qty}</span> pcs
                        {isSend && <span className="text-secondary/30"> · {available} available</span>}
                        {over && <span className="ml-1 font-semibold">exceeds stock</span>}
                      </p>
                    </div>
                    <button
                      onClick={() => openQty(item)}
                      className="h-8 px-2.5 inline-flex items-center rounded-lg border border-secondary/20 text-2.5 font-bold text-secondary hover:bg-secondary/10 transition-colors">
                      Edit
                    </button>
                    <button
                      onClick={() => updateQty(item.id, 0)}
                      aria-label="Remove"
                      className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-lg text-secondary/40 hover:text-error hover:bg-error/10 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
          </>
        )}

        {/* STEP 3 — review & confirm */}
        {step === 3 && (
          <>
            <div className="bg-white border border-secondary/10 rounded-xl p-4 mb-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <label className="text-xs font-medium text-secondary/70">Review</label>
                <span className="text-2.5 text-secondary/40">
                  {picked.size} item{picked.size === 1 ? "" : "s"} • {totalQty} pcs
                </span>
              </div>
              <div className="flex items-center justify-between text-3 mb-3 pb-3 border-b border-secondary/5">
                <span className="text-secondary/50">{isSend ? "To" : "From"}</span>
                <span className="font-semibold text-secondary">{otherBranchName ?? "—"}</span>
              </div>
              <div className="flex flex-col">
                {pickedList.map(({ item, qty }) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 py-1.5 border-b border-secondary/5 last:border-b-0">
                    <span className="text-xs text-secondary truncate">{item.name}</span>
                    <span className="text-2.5 font-semibold tabular-nums text-secondary shrink-0">{qty} pcs</span>
                  </div>
                ))}
              </div>
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
          </>
        )}

        {(error || (step === 3 && validationErr)) && (
          <div className="bg-error/10 border border-error/20 text-error text-2.5 px-3 py-2 rounded-lg mb-3">
            {error || validationErr}
          </div>
        )}

        {/* Wizard navigation */}
        <div className="flex gap-3">
          {step === 1 ? (
            <Link
              href={`/${branchId}/transfers`}
              className="flex-1 px-4 py-3 text-center text-xs text-secondary/80 bg-white border border-secondary/20 rounded-lg hover:bg-gray-50 transition-colors font-semibold">
              Cancel
            </Link>
          ) : (
            <button
              onClick={() => setStep(s => s - 1)}
              className="flex-1 px-4 py-3 text-center text-xs text-secondary/80 bg-white border border-secondary/20 rounded-lg hover:bg-gray-50 transition-colors font-semibold">
              Back
            </button>
          )}
          {step < 3 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!canAdvance}
              className={`flex-1 px-4 py-3 rounded-lg text-xs font-semibold transition-all ${
                canAdvance ? "bg-accent text-primary hover:bg-accent/90" : "bg-gray-100 text-secondary/50 cursor-not-allowed"
              }`}>
              Next
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting || !!validationErr}
              className={`flex-1 px-4 py-3 rounded-lg text-xs font-semibold transition-all ${
                submitting || validationErr
                  ? "bg-gray-100 text-secondary/50 cursor-not-allowed"
                  : "bg-accent text-primary hover:bg-accent/90"
              }`}>
              {submitting ? "Creating..." : isSend ? "Send transfer" : "Submit request"}
            </button>
          )}
        </div>
      </div>

      {/* Quantity sheet — choose how many of the tapped item */}
      {qtyItem && (() => {
        const available = getAvailableStock(qtyItem);
        // Requests aren't capped by stock; sends are.
        const cap = isSend ? available : Infinity;
        const n = Math.min(Math.max(0, parseInt(qtyDraft || "0", 10) || 0), cap);
        const bump = (d: number) => setQtyDraft(String(Math.min(Math.max(0, n + d), cap)));
        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-primary/70 p-4" onClick={closeQty}>
            <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="px-5 py-4 border-b border-secondary/10">
                <p className="text-sm font-semibold text-secondary truncate">{qtyItem.name}</p>
                <p className="text-2.5 text-secondary/50 mt-0.5">
                  {isSend ? (
                    <>
                      Available: <span className="tabular-nums">{available}</span>
                      {qtyItem.reserved_stock > 0 && (
                        <span className="ml-1 text-secondary/30">({qtyItem.reserved_stock} reserved)</span>
                      )}
                    </>
                  ) : (
                    "How many do you want to request?"
                  )}
                </p>
              </div>

              <div className="px-5 py-5 flex items-center justify-center gap-4">
                <button
                  onClick={() => bump(-1)}
                  disabled={n <= 0}
                  className="h-12 w-12 rounded-full border border-secondary/20 text-secondary text-xl font-bold flex items-center justify-center hover:bg-secondary/10 disabled:opacity-30 active:scale-95 transition-all">
                  −
                </button>
                <input
                  type="number"
                  min={0}
                  max={isSend ? available : undefined}
                  autoFocus
                  value={qtyDraft}
                  onChange={e => setQtyDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") confirmQty(); }}
                  className="flex-1 min-w-0 h-14 text-center text-2xl font-bold tabular-nums text-secondary border border-secondary/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                  onClick={() => bump(1)}
                  disabled={n >= cap}
                  className="h-12 w-12 rounded-full border border-secondary/20 text-secondary text-xl font-bold flex items-center justify-center hover:bg-secondary/10 disabled:opacity-30 active:scale-95 transition-all">
                  +
                </button>
              </div>

              <div className="px-5 pb-5 flex gap-3">
                <button
                  onClick={closeQty}
                  className="flex-1 px-4 py-3 text-center text-xs font-semibold text-secondary/80 bg-white border border-secondary/20 rounded-lg hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button
                  onClick={confirmQty}
                  className="flex-1 px-4 py-3 rounded-lg text-xs font-semibold bg-accent text-primary hover:bg-accent/90 transition-colors">
                  {picked.has(qtyItem.id) ? (n <= 0 ? "Remove" : "Update") : "Add"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default function NewTransferPage() {
  return (
    <Suspense fallback={null}>
      <NewTransferPageInner />
    </Suspense>
  );
}
