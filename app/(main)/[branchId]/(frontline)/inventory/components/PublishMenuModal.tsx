"use client";

// Publish Menu — copy bundle definitions + categories from the commissary to
// selected branches. Items are no longer published here: the commissary is
// the sole item source and every branch auto-carries every commissary item
// via branch_item_stock (migration 0022). Bundles have no per-branch stock
// equivalent, so they still need to be explicitly published. Owner-gated,
// commissary-only.

import { useEffect, useMemo, useState } from "react";
import { syncCatalog, type SyncReport } from "@/services/catalogSyncService";
import { getBundles } from "@/services/bundleService";
import type { Bundle } from "@/types/domain";

interface PublishMenuModalProps {
	isOpen: boolean;
	onClose: () => void;
	userId: string;
	sourceBranchId: string;
	sourceBranchName: string;
	subBranches: Array<{ id: string; name: string }>;
}

export default function PublishMenuModal({
	isOpen,
	onClose,
	userId,
	sourceBranchId,
	sourceBranchName,
	subBranches,
}: PublishMenuModalProps) {
	const [search, setSearch] = useState("");
	const [bundles, setBundles] = useState<Bundle[]>([]);
	const [loadingBundles, setLoadingBundles] = useState(true);
	const [pickedBundles, setPickedBundles] = useState<Set<string>>(new Set());
	const [pickedDestIds, setPickedDestIds] = useState<Set<string>>(new Set());
	const [running, setRunning] = useState(false);
	const [reports, setReports] = useState<Array<{ branch: string; report: SyncReport }>>([]);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!isOpen) return;
		setLoadingBundles(true);
		getBundles(sourceBranchId).then(({ bundles: b, error: err }) => {
			setBundles(b ?? []);
			if (err) setError(`Failed to load bundles: ${err.message ?? err}`);
			setLoadingBundles(false);
		});
	}, [isOpen, sourceBranchId]);

	const filteredBundles = useMemo(() => {
		const q = search.trim().toLowerCase();
		return bundles
			.filter((b) => b.status === "active")
			.filter((b) => (q ? b.name.toLowerCase().includes(q) : true))
			.sort((a, b) => a.name.localeCompare(b.name));
	}, [bundles, search]);

	if (!isOpen) return null;

	const togglePickedBundle = (id: string) => {
		setPickedBundles((prev) => {
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

	const allBundleIds = filteredBundles.map((b) => b.id);
	const allBundlesPicked = allBundleIds.length > 0 && allBundleIds.every((id) => pickedBundles.has(id));
	const toggleAllBundles = () => {
		setPickedBundles(allBundlesPicked ? new Set() : new Set(allBundleIds));
	};

	const handleClose = () => {
		if (running) return;
		onClose();
	};

	const handlePublish = async () => {
		if (pickedBundles.size === 0 || pickedDestIds.size === 0) return;
		setRunning(true);
		setError(null);
		setReports([]);

		const bundleIdList = Array.from(pickedBundles);
		const out: Array<{ branch: string; report: SyncReport }> = [];
		for (const destId of pickedDestIds) {
			const branchName = subBranches.find((b) => b.id === destId)?.name ?? destId;
			const { report, error } = await syncCatalog(userId, sourceBranchId, destId, {
				bundleIds: bundleIdList,
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
			className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6"
			onClick={handleClose}>
			<div
				className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col"
				onClick={(e) => e.stopPropagation()}>
				{/* Header */}
				<div className="px-5 py-4 border-b border-secondary/10">
					<div className="flex items-start justify-between gap-3">
						<div>
							<h2 className="text-lg font-semibold text-secondary">Publish Bundles</h2>
							<p className="text-xs text-secondary/60 mt-0.5">
								Copy bundle definitions and their categories from{" "}
								<span className="font-semibold">{sourceBranchName}</span> to other branches. Items no
								longer need publishing — every branch already carries the full commissary catalog.
							</p>
						</div>
						<button aria-label="Close"
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

					{/* Bundles */}
					<div>
						<div className="flex items-center justify-between mb-2">
							<p className="text-xs font-medium text-secondary/70">
								Bundles to publish <span className="text-secondary/40">({pickedBundles.size})</span>
							</p>
							<button onClick={toggleAllBundles} className="text-2.5 text-accent hover:underline">
								{allBundlesPicked ? "Deselect all" : "Select all"}
							</button>
						</div>

						<input
							type="text"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder="Search bundles…"
							className="w-full border border-secondary/20 rounded-lg h-9.5 px-3 text-3 focus:outline-none focus:ring-2 focus:ring-accent mb-2"
						/>

						{loadingBundles ? (
							<p className="text-2.5 text-secondary/40 text-center py-4">Loading bundles…</p>
						) : filteredBundles.length === 0 ? (
							<p className="text-2.5 text-secondary/40 text-center py-4">No active bundles.</p>
						) : (
							<div className="max-h-64 overflow-y-auto -mx-1 border border-secondary/10 rounded-lg">
								{filteredBundles.map((bundle) => {
									const picked = pickedBundles.has(bundle.id);
									return (
										<label
											key={bundle.id}
											className={`px-3 py-2 border-b border-secondary/5 last:border-b-0 flex items-center gap-3 cursor-pointer ${
												picked ? "bg-accent/5" : ""
											}`}>
											<input
												type="checkbox"
												checked={picked}
												onChange={() => togglePickedBundle(bundle.id)}
												className="accent-accent shrink-0"
											/>
											<div className="flex-1 min-w-0">
												<p className="text-xs font-medium text-secondary truncate">{bundle.name}</p>
												<p className="text-2.5 text-secondary/50">₱{bundle.price.toFixed(2)}</p>
											</div>
										</label>
									);
								})}
							</div>
						)}
					</div>

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
						disabled={running || pickedBundles.size === 0 || pickedDestIds.size === 0}
						className={`flex-1 px-4 py-2.5 rounded-lg text-xs font-semibold ${
							running || pickedBundles.size === 0 || pickedDestIds.size === 0
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
