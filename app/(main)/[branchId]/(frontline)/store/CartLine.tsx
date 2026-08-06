"use client";

import { useState } from "react";
import SafeImage from "@/components/SafeImage";
import LogoIcon from "./icons/LogoIcon";
import { formatCurrency } from "@/lib/currency_formatter";
import type { BundleComponent, InventoryItem } from "@/types/domain";
import QuantityStepper from "../inventory/components/QuantityStepper";

export interface CartLineItem {
	id: string;
	name: string;
	price: number;
	quantity: number;
	imgUrl?: string | null;
	type?: "item" | "bundle";
	is_custom?: boolean;
	isFoodHouse?: boolean;
	isB1T1?: boolean;
	isPriceOverride?: boolean;
	isPriced?: boolean;
	priceMode?: "per_piece" | "whole";
	wholePrice?: number | null;
	components?: BundleComponent[];
}

// A single order line: tall clickable [−] on the left, tappable item info in the middle,
// tall [+] on the right. Quantity is shown inline with the name/price.
export default function CartLine({
	item,
	openable,
	showB1T1,
	onOpen,
	onDec,
	onInc,
	onRemove,
	onMarkB1T1,
	availableComponents,
	onComponentQuantityChange,
	onAddComponent,
}: {
	item: CartLineItem;
	openable: boolean;
	showB1T1: boolean;
	onOpen: () => void;
	onDec: () => void;
	onInc: () => void;
	onRemove: () => void;
	onMarkB1T1: () => void;
	// Standard bilao/combo itemization — omit to keep the read-only chip view.
	availableComponents?: InventoryItem[];
	onComponentQuantityChange?: (inventoryItemId: string, quantity: number) => void;
	onAddComponent?: (item: InventoryItem) => void;
}) {
	const [showAddPicker, setShowAddPicker] = useState(false);
	const [pickerQuery, setPickerQuery] = useState("");
	const editable = !!onComponentQuantityChange;
	// Food House lines are custom (dish untracked) but sold per-order, so they
	// still get a quantity stepper.
	const hasStepper = !item.is_custom || !!item.isFoodHouse;
	// Whole-priced lines carry an absolute line total — display it directly, never price × qty.
	const isWhole = item.priceMode === "whole" && item.wholePrice != null;
	const displayLineTotal = isWhole ? (item.wholePrice as number) : item.price * item.quantity;
	const sideBtn =
		"shrink-0 w-14 rounded-2xl bg-light-accent hover:bg-accent active:bg-accent/80 transition-all flex items-center justify-center group/side";
	const sideSymbol = "text-3xl font-bold leading-none text-secondary group-hover/side:text-primary select-none";

	return (
		<div className="flex flex-col w-full">
			{/* Summary row: tall clickable [−] on the left, tappable item info in the
			    middle, tall [+] on the right. The side buttons stretch to match only
			    THIS row — the bundle itemization below sits outside it so they never
			    grow past a normal button height. */}
			<div className="flex items-stretch gap-2 w-full">
				{hasStepper ? (
					<button onClick={onDec} aria-label="Decrease quantity" className={sideBtn}>
						<span className={sideSymbol}>−</span>
					</button>
				) : (
					<button onClick={onRemove} aria-label={`Remove ${item.name}`} title="Remove from order" className={sideBtn}>
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
							{isWhole && <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 bg-accent/20 text-accent rounded">Whole</span>}
						</div>

						{/* Price · ×qty · total */}
						<div className="flex flex-row items-center justify-between gap-2 w-full">
							<span className="flex items-center gap-2 min-w-0">
								{openable ? (
									<span className="font-semibold text-xs text-secondary font-poppins truncate">
										{item.isPriced !== false ? formatCurrency(item.price) : <span className="text-accent">Set price</span>}
									</span>
								) : (
									<span className="font-normal text-xs text-secondary font-poppins">{formatCurrency(item.price)}</span>
								)}
								{(!item.is_custom || item.isFoodHouse) && (
									<span className="shrink-0 font-bold text-xs text-primary font-poppins bg-accent/80 px-2 py-0.5 rounded-full min-w-6 text-center">
										×{item.quantity}
									</span>
								)}
							</span>
							<span className="flex items-center gap-1.5 shrink-0">
								<span className="text-xs text-secondary/50">=</span>
								<span className="font-bold text-xs text-secondary font-poppins tabular-nums">{formatCurrency(displayLineTotal)}</span>
							</span>
						</div>

						{/* Bundle item count — the itemized list always renders below, expanded */}
						{item.type === "bundle" && item.components && (
							<span className="text-xs text-bundle font-medium w-fit">
								{item.components.length} item{item.components.length !== 1 ? "s" : ""}
							</span>
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

				{/* Plus */}
				{hasStepper && (
					<button onClick={onInc} aria-label="Increase quantity" className={sideBtn}>
						<span className={sideSymbol}>+</span>
					</button>
				)}
			</div>

			{/* Bundle itemization — full width below the summary row, indented to
			    align under the name text (image width + gap), so the [−]/[+] side
			    buttons above never stretch to cover it. */}
			{item.type === "bundle" && item.components && (
				<div className="pl-17 pr-2" onClick={(e) => e.stopPropagation()}>
					{editable ? (
						// Tree itemization: a left guide rail with each piece as its own
						// row (name + own compact stepper), and an "add a piece" row
						// appended at the bottom of the same rail.
						<div className="mt-1 pl-3 border-l-2 border-bundle/25 flex flex-col gap-1">
							{item.components.map((comp) => (
								<div key={comp.id || comp.inventory_item_id} className="flex items-center gap-2 py-0.5">
									<span className="flex-1 min-w-0 text-xs font-medium text-secondary truncate">{comp.inventory_item?.name || "Item"}</span>
									<QuantityStepper
										value={comp.quantity}
										onChange={(next) => onComponentQuantityChange!(comp.inventory_item_id, next)}
										min={0}
									/>
								</div>
							))}

							{onAddComponent && (
								!showAddPicker ? (
									<button
										onClick={() => setShowAddPicker(true)}
										className="w-full mt-0.5 py-2 flex items-center justify-center gap-1.5 text-xs font-black uppercase tracking-wide text-bundle border border-dashed border-bundle/50 rounded-lg hover:bg-bundle/5 hover:border-bundle transition-colors"
									>
										<span className="text-sm leading-none">+</span>
										<span>Add Piece</span>
									</button>
								) : (
									<div className="rounded-lg border border-bundle/40 bg-white shadow-sm p-2">
										<div className="flex items-center gap-1.5 mb-1.5">
											<input
												autoFocus
												value={pickerQuery}
												onChange={(e) => setPickerQuery(e.target.value)}
												placeholder="Search pieces…"
												className="flex-1 min-w-0 text-xs leading-5 px-2 py-1.5 rounded-md border border-secondary/20 focus:outline-none focus:ring-1 focus:ring-bundle"
											/>
											<button
												onClick={() => { setShowAddPicker(false); setPickerQuery(""); }}
												aria-label="Cancel"
												className="shrink-0 w-6 h-6 rounded-md text-secondary/50 hover:text-secondary hover:bg-secondary/10 flex items-center justify-center"
											>
												<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
											</button>
										</div>
										<div className="max-h-36 overflow-y-auto divide-y divide-secondary/5">
											{(() => {
												const results = (availableComponents ?? [])
													.filter((inv) => !item.components!.some((c) => c.inventory_item_id === inv.id))
													.filter((inv) => inv.name.toLowerCase().includes(pickerQuery.toLowerCase()));
												if (results.length === 0) {
													return <p className="text-xs text-secondary/40 text-center py-2">No matching pieces</p>;
												}
												return results.map((inv) => (
													<button
														key={inv.id}
														onClick={() => { onAddComponent(inv); setShowAddPicker(false); setPickerQuery(""); }}
														className="w-full text-left text-xs leading-5 px-2 py-1.5 hover:bg-bundle/10 text-secondary truncate block"
													>
														{inv.name}
													</button>
												));
											})()}
										</div>
									</div>
								)
							)}
						</div>
					) : (
						<div className="mt-1 pl-3 border-l-2 border-bundle/25 flex flex-col gap-1">
							{item.components.map((comp) => (
								<div key={comp.id || comp.inventory_item_id} className="flex items-center gap-2 py-0.5">
									<span className="flex-1 min-w-0 text-xs font-medium text-secondary truncate">{comp.inventory_item?.name || "Item"}</span>
									<span className="shrink-0 text-xs font-bold text-bundle tabular-nums">×{comp.quantity}</span>
								</div>
							))}
						</div>
					)}
				</div>
			)}
		</div>
	);
}
