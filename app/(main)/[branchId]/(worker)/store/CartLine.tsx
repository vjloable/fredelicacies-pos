"use client";

import SafeImage from "@/components/SafeImage";
import LogoIcon from "./icons/LogoIcon";
import { formatCurrency } from "@/lib/currency_formatter";
import type { BundleComponent } from "@/types/domain";

export interface CartLineItem {
	id: string;
	name: string;
	price: number;
	quantity: number;
	imgUrl?: string | null;
	type?: "item" | "bundle";
	is_custom?: boolean;
	isB1T1?: boolean;
	isPriceOverride?: boolean;
	components?: BundleComponent[];
}

// A single order line: tall clickable [−] on the left, tappable item info in the middle,
// tall [+] on the right. Quantity is shown inline with the name/price.
export default function CartLine({
	item,
	openable,
	expanded,
	showB1T1,
	onOpen,
	onDec,
	onInc,
	onToggleExpand,
	onMarkB1T1,
}: {
	item: CartLineItem;
	openable: boolean;
	expanded: boolean;
	showB1T1: boolean;
	onOpen: () => void;
	onDec: () => void;
	onInc: () => void;
	onToggleExpand: () => void;
	onMarkB1T1: () => void;
}) {
	const hasStepper = !item.is_custom;
	const sideBtn =
		"shrink-0 w-14 rounded-2xl bg-light-accent hover:bg-accent active:scale-95 transition-all flex items-center justify-center group/side";
	const sideSymbol = "text-3xl font-bold leading-none text-secondary group-hover/side:text-primary select-none";

	return (
		<div className="flex items-stretch gap-2 w-full">
			{/* Minus — tall rectangle on the left */}
			{hasStepper && (
				<button onClick={onDec} aria-label="Decrease quantity" className={sideBtn}>
					<span className={sideSymbol}>−</span>
				</button>
			)}

			{/* Item info — the clickable center */}
			<div
				onClick={openable ? onOpen : undefined}
				className={`flex-1 min-w-0 flex flex-row items-center gap-3 rounded-xl p-2 transition-colors ${
					openable ? "cursor-pointer hover:bg-accent/5 active:bg-accent/10" : ""
				}`}
			>
				<div className="flex-none w-14 h-14 bg-gray-100 rounded-md relative overflow-hidden">
					{item.imgUrl ? (
						<SafeImage src={item.imgUrl} alt={item.name} />
					) : (
						<div className="w-full h-full flex items-center justify-center">
							<LogoIcon className="w-10 h-10 opacity-25" />
						</div>
					)}
				</div>

				<div className="flex-1 min-w-0 flex flex-col gap-1">
					{/* Name + badges */}
					<div className="flex flex-row items-center gap-2">
						<span className="font-normal text-sm text-secondary font-poppins truncate">{item.name}</span>
						{item.isB1T1 && <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 bg-accent/20 text-accent rounded">B1T1</span>}
						{item.is_custom && <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 bg-bundle/20 text-bundle rounded">Custom</span>}
						{item.isPriceOverride && <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded">Price adj.</span>}
					</div>

					{/* Price · ×qty · total */}
					<div className="flex flex-row items-center justify-between gap-2 w-full">
						<span className="flex items-center gap-2 min-w-0">
							{openable ? (
								<span className="font-semibold text-xs text-secondary font-poppins truncate">
									{item.price > 0 ? formatCurrency(item.price) : <span className="text-accent">Set price</span>}
								</span>
							) : (
								<span className="font-normal text-xs text-secondary font-poppins">{formatCurrency(item.price)}</span>
							)}
							{!item.is_custom && (
								<span className="shrink-0 font-bold text-xs text-primary font-poppins bg-accent/80 px-2 py-0.5 rounded-full min-w-6 text-center">
									×{item.quantity}
								</span>
							)}
						</span>
						<span className="flex items-center gap-1.5 shrink-0">
							<span className="text-xs text-secondary/50">=</span>
							<span className="font-bold text-xs text-secondary font-poppins tabular-nums">{formatCurrency(item.price * item.quantity)}</span>
						</span>
					</div>

					{/* Bundle components */}
					{item.type === "bundle" && item.components && (
						<div className="mt-0.5">
							<button
								onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
								className="flex items-center gap-1 text-xs text-bundle font-medium hover:text-bundle transition-colors"
							>
								<span>{item.components.length} item{item.components.length !== 1 ? "s" : ""}</span>
								<svg className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 4l4 4 4-4" /></svg>
							</button>
							{expanded && (
								<div className="flex flex-wrap gap-1 mt-1">
									{item.components.map((comp) => (
										<span key={comp.id || comp.inventory_item_id} className="inline-flex items-center gap-0.5 bg-bundle/10 border border-bundle/40 text-bundle text-xs font-medium px-1 py-0.5 rounded">
											<span>{comp.inventory_item?.name || "Item"}</span>
											<span className="shrink-0 opacity-60">×{comp.quantity}</span>
										</span>
									))}
								</div>
							)}
						</div>
					)}

					{/* B1T1 action */}
					{showB1T1 && (
						<div className="flex flex-row justify-start w-full mt-0.5">
							<button
								onClick={(e) => { e.stopPropagation(); onMarkB1T1(); }}
								className="text-xs font-bold px-2.5 py-1 rounded-lg bg-accent/10 text-accent border border-accent/30 hover:bg-accent hover:text-primary transition-all"
							>
								Mark as B1T1
							</button>
						</div>
					)}
				</div>
			</div>

			{/* Plus — tall rectangle on the right */}
			{hasStepper && (
				<button onClick={onInc} aria-label="Increase quantity" className={sideBtn}>
					<span className={sideSymbol}>+</span>
				</button>
			)}
		</div>
	);
}
