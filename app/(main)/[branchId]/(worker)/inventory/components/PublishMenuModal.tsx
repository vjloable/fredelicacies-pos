"use client";

// Publish Menu — copy items + categories + bundles from the main branch to
// selected sub-branches. Only meaningful on the main branch; owner-gated.

import { useMemo, useState } from "react";
import { syncCatalog, type SyncReport } from "@/services/catalogSyncService";
import type { InventoryItem } from "@/types/domain";

interface PublishMenuModalProps {
	isOpen: boolean;
	onClose: () => void;
	userId: string;
	sourceBranchId: string;
	sourceBranchName: string;
	items: InventoryItem[];
	subBranches: Array<{ id: string; name: string }>;
}

export default function PublishMenuModal({
	isOpen,
	onClose,
	userId,
	sourceBranchId,
	sourceBranchName,
	items,
	subBranches,
}: PublishMenuModalProps) {
	const [search, setSearch] = useState("");
	const [pickedItems, setPickedItems] = useState<Set<string>>(new Set());
	const [pickedDestIds, setPickedDestIds] = useState<Set<string>>(new Set());
	const [includeBundles, setIncludeBundles] = useState(true);
	const [running, setRunning] = useState(false);
	const [reports, setReports] = useState<Array<{ branch: string; report: SyncReport }>>([]);
	const [error, setError] = useState<string | null>(null);

	const filteredItems = useMemo(() => {
		const q = search.trim().toLowerCase();
		return items
			.filter((i) => i.status === "active")
			.filter((i) => (q ? i.name.toLowerCase().includes(q) : true))
			.sort((a, b) => a.name.localeCompare(b.name));
	}, [items, search]);

	if (!isOpen) return null;

	const togglePickedItem = (id: string) => {
		setPickedItems((prev) => {
			const n = new Set(prev);
			if (n.has(id)) n.delete(id);
			else n.add(id);
			return n;
		});
	};

	const togglePickedDest = (id: string) => {
		setPickedDestIds((prev) => {
			const n = new Set(prev);
			if (n.has(id)) n.delete(id);
			else n.add(id);
			return n;
		});
	};

	const allItemIds = filteredItems.map((i) => i.id);
	const allItemsPicked = allItemIds.length > 0 && allItemIds.every((id) => pickedItems.has(id));
	const toggleAllItems = () => {
		setPickedItems(allItemsPicked ? new Set() : new Set(allItemIds));
	};

	const handleClose = () => {
		if (running) return;
		onClose();
	};

	const handlePublish = async () => {
		if (pickedItems.size === 0 || pickedDestIds.size === 0) return;
		setRunning(true);
		setError(null);
		setReports([]);

		const itemIdList = Array.from(pickedItems);
		const out: Array<{ branch: string; report: SyncReport }> = [];
		for (const destId of pickedDestIds) {
			const branchName = subBranches.find((b) => b.id === destId)?.name ?? destId;
			const { report, error } = await syncCatalog(userId, sourceBranchId, destId, {
				itemIds: itemIdList,
				includeBundles,
			});
			if (error) {
				setError(`Publish to ${branchName} failed: ${error.message ?? error}`);
				setRunning(false);
				return;
			}
			out.push({ branch: branchName, report });
		}

		setReports(out);
		setRunning(false);
	};

	return (
		<div
			className="fixed inset-0 bg-primary/80 flex items-center justify-center z-50 p-4 sm:p-6"
			onClick={handleClose}>
			<div
				className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col"
				onClick={(e) => e.stopPropagation()}>
				{/* Header */}
				<div className="px-5 py-4 border-b border-secondary/10">
					<div className="flex items-start justify-between gap-3">
						<div>
							<h2 className="text-lg font-semibold text-secondary">Publish Menu</h2>
							<p className="text-xs text-secondary/60 mt-0.5">
								Copy items, categories, and bundles from{" "}
								<span className="font-semibold">{sourceBranchName}</span> to other branches.
							</p>
						</div>
						<button
							onClick={handleClose}
							className="shrink-0 p-1.5 rounded-lg text-secondary/40 hover:text-secondary hover:bg-secondary/10 transition-colors">
							<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>
				</div>

				<div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
					{/* Destinations */}
					<div>
						<p className="text-xs font-medium text-secondary/70 mb-2">Destination branches</p>
						{subBranches.length === 0 ? (
							<p className="text-2.5 text-secondary/40">No other branches yet.</p>
						) : (
							<div className="flex flex-wrap gap-2">
								{subBranches.map((b) => {
									const picked = pickedDestIds.has(b.id);
									return (
										<button
											key={b.id}
											onClick={() => togglePickedDest(b.id)}
											className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
												picked
													? "bg-accent text-primary border-accent"
													: "bg-white text-secondary border-secondary/20 hover:border-secondary/40"
											}`}>
											{b.name}
										</button>
									);
								})}
							</div>
						)}
					</div>

					{/* Items */}
					<div>
						<div className="flex items-center justify-between mb-2">
							<p className="text-xs font-medium text-secondary/70">
								Items to publish <span className="text-secondary/40">({pickedItems.size})</span>
							</p>
							<button onClick={toggleAllItems} className="text-2.5 text-accent hover:underline">
								{allItemsPicked ? "Deselect all" : "Select all"}
							</button>
						</div>

						<input
							type="text"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder="Search items…"
							className="w-full border-2 border-secondary/20 rounded-lg h-9.5 px-3 text-3 focus:outline-none focus:ring-2 focus:ring-accent mb-2"
						/>

						{filteredItems.length === 0 ? (
							<p className="text-2.5 text-secondary/40 text-center py-4">No active items.</p>
						) : (
							<div className="max-h-64 overflow-y-auto -mx-1 border border-secondary/10 rounded-lg">
								{filteredItems.map((item) => {
									const picked = pickedItems.has(item.id);
									return (
										<label
											key={item.id}
											className={`px-3 py-2 border-b border-secondary/5 last:border-b-0 flex items-center gap-3 cursor-pointer ${
												picked ? "bg-accent/5" : ""
											}`}>
											<input
												type="checkbox"
												checked={picked}
												onChange={() => togglePickedItem(item.id)}
												className="accent-accent shrink-0"
											/>
											<div className="flex-1 min-w-0">
												<p className="text-xs font-medium text-secondary truncate">{item.name}</p>
												<p className="text-2.5 text-secondary/50">
													₱{item.price.toFixed(2)}
													{item.cost != null && (
														<span className="ml-2 text-secondary/40">cost ₱{item.cost.toFixed(2)}</span>
													)}
												</p>
											</div>
										</label>
									);
								})}
							</div>
						)}
					</div>

					{/* Options */}
					<label className="flex items-center gap-2 text-xs text-secondary cursor-pointer">
						<input
							type="checkbox"
							checked={includeBundles}
							onChange={(e) => setIncludeBundles(e.target.checked)}
							className="accent-accent"
						/>
						Include bundles (incomplete bundles land as inactive, flagged for review)
					</label>

					{error && (
						<div className="bg-error/10 border border-error/20 text-error text-2.5 px-3 py-2 rounded-lg">
							{error}
						</div>
					)}

					{reports.length > 0 && (
						<div className="space-y-3">
							<h3 className="text-xs font-semibold text-secondary uppercase tracking-wide">Results</h3>
							{reports.map((r, i) => (
								<div key={i} className="bg-secondary/5 border border-secondary/10 rounded-xl p-3">
									<p className="text-sm font-semibold text-secondary mb-1">{r.branch}</p>
									<ul className="text-2.5 text-secondary/70 space-y-0.5">
										<li>Items created {r.report.items.created} / skipped {r.report.items.skipped}</li>
										<li>Categories created {r.report.categories.created} / skipped {r.report.categories.skipped}</li>
										<li>
											Bundles created {r.report.bundles.created} / skipped {r.report.bundles.skipped}
											{r.report.bundles.needs_attention > 0 && (
												<span className="ml-2 text-amber-700 font-semibold">
													({r.report.bundles.needs_attention} need review)
												</span>
											)}
										</li>
										{r.report.warnings.map((w, j) => (
											<li key={j} className="text-error">{w}</li>
										))}
									</ul>
								</div>
							))}
						</div>
					)}
				</div>

				{/* Footer */}
				<div className="px-5 py-4 border-t border-secondary/10 flex gap-3">
					<button
						onClick={handleClose}
						className="flex-1 px-4 py-2.5 text-center text-xs text-secondary/80 bg-white border border-secondary/20 rounded-lg hover:bg-gray-50 font-semibold">
						{reports.length > 0 ? "Done" : "Cancel"}
					</button>
					<button
						onClick={handlePublish}
						disabled={running || pickedItems.size === 0 || pickedDestIds.size === 0}
						className={`flex-1 px-4 py-2.5 rounded-lg text-xs font-semibold ${
							running || pickedItems.size === 0 || pickedDestIds.size === 0
								? "bg-gray-100 text-secondary/50 cursor-not-allowed"
								: "bg-accent text-primary hover:bg-accent/90"
						}`}>
						{running
							? "Publishing..."
							: `Publish to ${pickedDestIds.size} branch${pickedDestIds.size === 1 ? "" : "es"}`}
					</button>
				</div>
			</div>
		</div>
	);
}
