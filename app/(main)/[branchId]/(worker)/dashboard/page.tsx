"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import TopBar from "@/components/TopBar";
import MobileTopBar from "@/components/MobileTopBar";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useBranch } from "@/contexts/BranchContext";
import { useAuth } from "@/contexts/AuthContext";
import { subscribeToInventoryItems } from "@/services/inventoryService";
import { getBranchTransfers, subscribeToBranchTransfers } from "@/services/transferService";
import type { InventoryItem } from "@/types/domain";
import type { TransferWithItems } from "@/types/domain";

const LOW_STOCK_THRESHOLD = 10;

// Commissary hub: fulfil requests, ship goods, and track stock — all via the transfers board.
export default function CommissaryDashboardPage() {
	const params = useParams();
	const branchId = typeof params.branchId === "string" ? params.branchId : "";
	const { currentBranch } = useBranch();
	const { getUserRoleForBranch, isUserOwner } = useAuth();
	const isManager = isUserOwner() || getUserRoleForBranch(branchId) === "manager";

	const [items, setItems] = useState<InventoryItem[]>([]);
	const [transfers, setTransfers] = useState<TransferWithItems[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (!branchId) return;
		const unsub = subscribeToInventoryItems(branchId, (list) => {
			setItems(list);
			setLoading(false);
		});
		return () => unsub?.();
	}, [branchId]);

	useEffect(() => {
		if (!branchId) return;
		let cancelled = false;
		const refresh = () => {
			getBranchTransfers(branchId, { limit: 100 }).then(({ transfers: t }) => {
				if (!cancelled) setTransfers(t);
			});
		};
		refresh();
		const unsub = subscribeToBranchTransfers(branchId, refresh);
		return () => {
			cancelled = true;
			unsub();
		};
	}, [branchId]);

	const stats = useMemo(() => {
		const active = items.filter((i) => i.status === "active");
		return {
			totalItems: active.length,
			totalStock: active.reduce((s, i) => s + (i.stock ?? 0), 0),
			lowStock: active.filter((i) => (i.stock ?? 0) < LOW_STOCK_THRESHOLD).length,
		};
	}, [items]);

	const pendingRequests = useMemo(
		() => transfers.filter((t) => t.direction === "pull" && t.source_branch_id === branchId && t.status === "sent" && !t.fulfilled_at).length,
		[transfers, branchId]
	);
	const inTransitCount = useMemo(
		() => transfers.filter((t) => t.source_branch_id === branchId && t.status === "sent" && (t.direction === "push" || !!t.fulfilled_at)).length,
		[transfers, branchId]
	);

	return (
		<div className="flex flex-col h-full">
			<div className="hidden xl:block">
				<TopBar />
			</div>
			<div className="xl:hidden">
				<MobileTopBar title="Dashboard" />
			</div>

			<div className="flex-1 overflow-y-auto px-6 py-4">
				<div className="flex items-start justify-between gap-3 mb-5">
					<div>
						<h1 className="text-lg font-semibold text-secondary">{currentBranch?.name ?? "Commissary"}</h1>
						<p className="text-xs text-secondary/60 mt-0.5">Fulfil requests, ship goods, and track where stock is.</p>
					</div>
					{isManager && (
						<Link
							href={`/${branchId}/transfers/new`}
							className="shrink-0 h-12 px-4 inline-flex items-center gap-2 rounded-lg bg-accent text-primary text-3 font-black shadow-sm hover:bg-accent/90 transition-all hover:scale-105 active:scale-95"
						>
							<svg className="w-4 h-4 drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
							<span className="text-shadow-md">NEW TRANSFER</span>
						</Link>
					)}
				</div>

				{loading ? (
					<div className="flex items-center justify-center py-16">
						<LoadingSpinner size="lg" />
					</div>
				) : (
					<>
						{/* Stat cards */}
						<div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
							<StatCard label="Inventory items" value={stats.totalItems} />
							<StatCard label="Pending requests" value={pendingRequests} accent={pendingRequests > 0 ? "accent" : undefined} />
							<StatCard label="In transit" value={inTransitCount} />
							<StatCard label="Low stock" value={stats.lowStock} accent={stats.lowStock > 0 ? "error" : undefined} />
						</div>

						{/* Transfers board CTA */}
						<Link
							href={`/${branchId}/transfers`}
							className="flex items-center justify-between gap-4 bg-white border border-secondary/10 rounded-xl px-5 py-4 hover:border-accent/30 hover:bg-accent/5 transition-colors group"
						>
							<div>
								<p className="text-sm font-semibold text-secondary group-hover:text-accent transition-colors">Open transfers board</p>
								<p className="text-2.5 text-secondary/50 mt-0.5">See requests, in-transit shipments, and completed transfers at a glance.</p>
							</div>
							<span className="shrink-0 text-secondary/30 group-hover:text-accent transition-colors text-lg">→</span>
						</Link>
					</>
				)}
			</div>
		</div>
	);
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: "accent" | "error" }) {
	const valueColor = accent === "accent" ? "text-accent" : accent === "error" ? "text-error" : "text-secondary";
	return (
		<div className="bg-white border border-secondary/10 rounded-xl p-4">
			<p className="text-2.5 text-secondary/50 mb-1">{label}</p>
			<p className={`text-2xl font-bold tabular-nums ${valueColor}`}>{value}</p>
		</div>
	);
}
