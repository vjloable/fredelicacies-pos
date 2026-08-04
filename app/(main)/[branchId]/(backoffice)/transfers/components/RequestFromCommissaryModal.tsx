"use client";

import { useEffect, useMemo, useState } from "react";
import { subscribeToInventoryItems } from "@/services/inventoryService";
import { createPullRequest } from "@/services/transferService";
import { getCategories } from "@/services/categoryService";
import type { InventoryItem, Category, Branch } from "@/types/domain";
import PageLoader from "@/components/PageLoader";

// Touch-friendly item row for the kiosk picker: tap anywhere to choose a quantity.
function ItemRow({
  item,
  qty,
  onPick,
}: {
  item: InventoryItem;
  qty: number;
  onPick: () => void;
}) {
  return (
    <button
      onClick={onPick}
      className={`w-full mx-1 my-0.5 px-2 py-2.5 rounded-lg border border-transparent flex items-center gap-3 text-left transition-colors ${
        qty > 0 ? "bg-accent/5 border-accent/20" : "hover:bg-secondary/5"
      }`}>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-secondary truncate">{item.name}</p>
      </div>
      {qty > 0 ? (
        <span className="h-7 min-w-7 px-2 shrink-0 inline-flex items-center justify-center rounded-lg bg-accent text-primary text-2.5 font-bold tabular-nums">
          {qty}
        </span>
      ) : (
        <span className="h-7 px-2.5 shrink-0 inline-flex items-center rounded-lg bg-secondary/10 text-secondary text-2.5 font-bold">
          Add
        </span>
      )}
    </button>
  );
}

interface RequestFromCommissaryModalProps {
  branchId: string;
  branchName: string;
  sourceBranches: Branch[];
  userId: string;
  onClose: () => void;
  onCreated: (transferId: string) => void;
}

export default function RequestFromCommissaryModal({
  branchId,
  branchName,
  sourceBranches,
  userId,
  onClose,
  onCreated,
}: RequestFromCommissaryModalProps) {
  const [note, setNote] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [picked, setPicked] = useState<Map<string, number>>(new Map());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Source branch: auto-selected if there's only one candidate, otherwise the user picks it.
  const [sourceId, setSourceId] = useState<string | null>(
    sourceBranches.length === 1 ? sourceBranches[0].id : null
  );
  const sourceBranch = sourceBranches.find(b => b.id === sourceId) ?? null;

  const [sourceItems, setSourceItems] = useState<InventoryItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);

  // Kiosk drill-down state: categories of the source branch + which folder is open.
  const [sourceCategories, setSourceCategories] = useState<Category[]>([]);
  const [pickerCategoryId, setPickerCategoryId] = useState<string | null>(null);
  // Item pending a quantity choice (opens the quantity sheet).
  const [qtyItem, setQtyItem] = useState<InventoryItem | null>(null);
  const [qtyDraft, setQtyDraft] = useState<string>("");
  const UNCAT = "__uncat__";

  // Wizard: 1 = source, 2 = items, 3 = review. Skip step 1 entirely when there's only one source.
  const [step, setStep] = useState(sourceBranches.length === 1 ? 2 : 1);
  const STEPS = sourceBranches.length === 1 ? ["Items", "Review"] : ["Source", "Items", "Review"];
  const itemsStep = sourceBranches.length === 1 ? 1 : 2;
  const reviewStep = sourceBranches.length === 1 ? 2 : 3;

  useEffect(() => {
    if (!sourceId) {
      setSourceItems([]);
      setLoadingItems(false);
      return;
    }
    setLoadingItems(true);
    const unsub = subscribeToInventoryItems(sourceId, items => {
      setSourceItems(items);
      setLoadingItems(false);
    });
    return () => {
      unsub?.();
    };
  }, [sourceId]);

  useEffect(() => {
    if (!sourceId) {
      setSourceCategories([]);
      return;
    }
    let cancelled = false;
    getCategories(sourceId).then(({ categories }) => {
      if (!cancelled) setSourceCategories(categories ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [sourceId]);

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
    const n = Math.max(0, parseInt(qtyDraft || "0", 10) || 0);
    updateQty(qtyItem.id, n);
    closeQty();
  };

  const totalQty = Array.from(picked.values()).reduce((s, n) => s + n, 0);

  const canAdvance = step === 1 && STEPS[0] === "Source" ? !!sourceId : step === itemsStep ? picked.size > 0 : true;

  const validationErr = (() => {
    if (picked.size === 0) return "Add at least one item.";
    for (const [id, qty] of picked.entries()) {
      const item = sourceItems.find(i => i.id === id);
      if (!item) return `Item ${id} no longer exists.`;
      if (qty <= 0) return `${item.name}: invalid quantity.`;
    }
    return null;
  })();

  const handleSubmit = async () => {
    if (!sourceId || validationErr) return;
    setSubmitting(true);
    setError(null);
    try {
      const items = Array.from(picked.entries()).map(([source_item_id, quantity_sent]) => ({
        source_item_id,
        quantity_sent,
      }));

      const { id, error } = await createPullRequest(userId, {
        source_branch_id: sourceId,
        destination_branch_id: branchId,
        note: note.trim() || undefined,
        items,
      });
      if (error || !id) {
        throw error instanceof Error ? error : new Error(String(error?.message ?? "Failed"));
      }
      onCreated(id);
    } catch (e: any) {
      setError(e.message ?? "Failed to create request");
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-secondary/10 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-secondary">Request</h2>
            <p className="text-xs text-secondary/60 mt-0.5">
              {sourceBranch
                ? `Request items from ${sourceBranch.name} to ${branchName}.`
                : `Request items into ${branchName}.`}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-lg text-secondary/40 hover:text-secondary hover:bg-secondary/10 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
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
                    <span className="text-2.5 font-semibold">{label}</span>
                  </div>
                  {n < STEPS.length && <span className="w-4 h-px bg-secondary/20" />}
                </div>
              );
            })}
          </div>

          {/* STEP — pick source branch (only when there's more than one candidate) */}
          {STEPS[0] === "Source" && step === 1 && (
            <div className="bg-white border border-secondary/10 rounded-xl p-4">
              <label className="text-xs font-medium text-secondary/70 block mb-3">Request from</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {sourceBranches.map(b => (
                  <button
                    key={b.id}
                    onClick={() => setSourceId(b.id)}
                    className={`flex items-center justify-between gap-2 p-3 rounded-lg border text-left transition-colors ${
                      sourceId === b.id ? "border-accent bg-accent/5" : "border-secondary/10 hover:border-accent/40"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold text-secondary truncate">{b.name}</span>
                      <span className="block text-2.5 text-secondary/40 capitalize">{b.type}</span>
                    </span>
                    {sourceId === b.id && (
                      <span className="h-5 w-5 shrink-0 rounded-full bg-accent text-primary flex items-center justify-center text-2.5 font-bold">✓</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP — pick items */}
          {step === itemsStep && (
            <>
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
                    placeholder="Search any item…"
                    className="w-full border border-secondary/20 rounded-lg h-10 pl-9 pr-3 text-3 focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>

                {loadingItems ? (
                  <PageLoader text="Loading items…" />
                ) : search.trim() ? (
                  searchResults.length === 0 ? (
                    <p className="text-xs text-secondary/40 text-center py-6">No items match.</p>
                  ) : (
                    <div className="max-h-96 overflow-y-auto -mx-1">
                      {searchResults.map(item => (
                        <ItemRow key={item.id} item={item} qty={picked.get(item.id) ?? 0} onPick={() => openQty(item)} />
                      ))}
                    </div>
                  )
                ) : pickerCategoryId === null ? (
                  categoryFolders.length === 0 ? (
                    <p className="text-xs text-secondary/40 text-center py-6">No items to request.</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                      {categoryFolders.map(f => (
                        <button
                          key={f.id}
                          onClick={() => setPickerCategoryId(f.id)}
                          className="group flex flex-col items-start gap-2 p-3 rounded-lg border border-secondary/10 hover:border-accent transition-all hover:shadow-sm active:bg-accent/10 text-left">
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
                      <div className="max-h-96 overflow-y-auto -mx-1">
                        {folderItems.map(item => (
                          <ItemRow key={item.id} item={item} qty={picked.get(item.id) ?? 0} onPick={() => openQty(item)} />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Requested items — the running list below the picker */}
              {pickedList.length > 0 && (
                <div className="bg-white border border-secondary/10 rounded-xl p-4">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <label className="text-xs font-medium text-secondary/70">Requested items</label>
                    <span className="text-2.5 text-secondary/40">{totalQty} pcs</span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {pickedList.map(({ item, qty }) => (
                      <div key={item.id} className="flex items-center gap-3 px-2 py-2 rounded-lg bg-accent/5 border border-accent/10">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-secondary truncate">{item.name}</p>
                          <p className="text-2.5 text-secondary/50">
                            <span className="tabular-nums font-semibold">{qty}</span> pcs
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
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* STEP — review & confirm */}
          {step === reviewStep && (
            <>
              <div className="bg-white border border-secondary/10 rounded-xl p-4 mb-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <label className="text-xs font-medium text-secondary/70">Review</label>
                  <span className="text-2.5 text-secondary/40">
                    {picked.size} item{picked.size === 1 ? "" : "s"} • {totalQty} pcs
                  </span>
                </div>
                <div className="flex items-center justify-between text-3 mb-3 pb-3 border-b border-secondary/5">
                  <span className="text-secondary/50">From</span>
                  <span className="font-semibold text-secondary">{sourceBranch?.name ?? "—"}</span>
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

              <div className="bg-white border border-secondary/10 rounded-xl p-4">
                <label className="text-xs font-medium text-secondary/70 block mb-2">
                  Note <span className="text-secondary/40">(optional)</span>
                </label>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Anything the source branch should know…"
                  rows={2}
                  className="w-full border border-secondary/20 rounded-lg px-3 py-2 text-3 focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                />
              </div>
            </>
          )}

          {(error || (step === reviewStep && validationErr)) && (
            <div className="bg-error/10 border border-error/20 text-error text-2.5 px-3 py-2 rounded-lg mt-4">
              {error || validationErr}
            </div>
          )}
        </div>

        {/* Wizard navigation */}
        <div className="px-6 py-4 border-t border-secondary/10 flex gap-3 shrink-0">
          {step === 1 ? (
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 text-center text-xs text-secondary/80 bg-white border border-secondary/20 rounded-lg hover:bg-gray-50 transition-colors font-semibold">
              Cancel
            </button>
          ) : (
            <button
              onClick={() => setStep(s => s - 1)}
              className="flex-1 px-4 py-3 text-center text-xs text-secondary/80 bg-white border border-secondary/20 rounded-lg hover:bg-gray-50 transition-colors font-semibold">
              Back
            </button>
          )}
          {step < reviewStep ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!canAdvance}
              className={`flex-1 px-4 py-3 rounded-lg text-xs font-semibold transition-all ${
                canAdvance ? "bg-accent text-primary hover:bg-accent/90 active:bg-light-accent" : "bg-gray-100 text-secondary/50 cursor-not-allowed"
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
                  : "bg-accent text-primary hover:bg-accent/90 active:bg-light-accent"
              }`}>
              {submitting ? "Creating..." : "Submit request"}
            </button>
          )}
        </div>
      </div>

      {/* Quantity sheet — choose how many of the tapped item */}
      {qtyItem && (() => {
        const n = Math.max(0, parseInt(qtyDraft || "0", 10) || 0);
        const bump = (d: number) => setQtyDraft(String(Math.max(0, n + d)));
        return (
          <div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-sm p-4" onClick={closeQty}>
            <div className="bg-white rounded-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
              <div className="px-5 py-4 border-b border-secondary/10">
                <p className="text-sm font-semibold text-secondary truncate">{qtyItem.name}</p>
                <p className="text-2.5 text-secondary/50 mt-0.5">How many do you want to request?</p>
              </div>

              <div className="px-5 py-5 flex items-center justify-center gap-4">
                <button
                  onClick={() => bump(-1)}
                  disabled={n <= 0}
                  className="h-12 w-12 rounded-full border border-secondary/20 text-secondary text-xl font-bold flex items-center justify-center hover:bg-secondary/10 disabled:opacity-30 active:bg-secondary/20 transition-all">
                  −
                </button>
                <input
                  type="number"
                  min={0}
                  autoFocus
                  value={qtyDraft}
                  onChange={e => setQtyDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") confirmQty(); }}
                  className="flex-1 min-w-0 h-14 text-center text-2xl font-bold tabular-nums text-secondary border border-secondary/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                  onClick={() => bump(1)}
                  className="h-12 w-12 rounded-full border border-secondary/20 text-secondary text-xl font-bold flex items-center justify-center hover:bg-secondary/10 active:bg-secondary/20 transition-all">
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
                  className="flex-1 px-4 py-3 rounded-lg text-xs font-semibold bg-accent text-primary hover:bg-accent/90 active:bg-light-accent transition-colors">
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
