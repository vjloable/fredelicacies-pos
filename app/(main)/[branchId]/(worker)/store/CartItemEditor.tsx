"use client";

import { useEffect, useState } from "react";

export type PricingMode = "per_piece" | "whole";

// The line's pricing state reported to the parent.
//   mode="per_piece" — perPiece is the source of truth; wholePrice is null.
//   mode="whole"     — wholePrice is the absolute, authoritative total for the whole line;
//                      perPiece is display-only and must never be reconstructed into wholePrice.
export interface PricingState {
	mode: PricingMode;
	perPiece: number;
	wholePrice: number | null;
}

// Touch-friendly editor for a cart line: calculator keypad for the selling price + a quantity stepper.
// Supports two pricing modes:
//   per_piece — the keypad sets the price for one piece; total = price × qty
//   whole     — the keypad sets an ABSOLUTE total for the whole line; qty does not rescale it
//               (no divide → round → multiply round-trip, so the typed total stays exact).
export default function CartItemEditor({
	name,
	price,
	wholePrice,
	priceMode = "per_piece",
	quantity,
	onPricingChange,
	onQuantityChange,
	onClose,
}: {
	name: string;
	price: number;
	wholePrice?: number | null;
	priceMode?: PricingMode;
	quantity: number;
	onPricingChange: (state: PricingState) => void;
	onQuantityChange: (delta: number) => void;
	onClose: () => void;
}) {
	const [mode, setMode] = useState<PricingMode>(priceMode);
	// priceStr holds the raw keypad value — per-piece when mode=per_piece, the absolute
	// whole total when mode=whole.
	const [priceStr, setPriceStr] = useState(
		priceMode === "whole" ? (wholePrice ? String(wholePrice) : "") : (price ? String(price) : "")
	);

	// Editable quantity that stays in sync with the ± stepper.
	const [qtyStr, setQtyStr] = useState(String(quantity));
	useEffect(() => { setQtyStr(String(quantity)); }, [quantity]);
	const onQtyInput = (v: string) => {
		if (!/^\d*$/.test(v)) return;
		setQtyStr(v);
		const n = parseInt(v, 10);
		if (Number.isFinite(n) && n >= 1 && n !== quantity) onQuantityChange(n - quantity);
	};

	// Report the current pricing state to the parent for a given mode + raw keypad value.
	const report = (nextMode: PricingMode, raw: number) => {
		if (nextMode === "whole") {
			// The typed value IS the absolute whole-line total. perPiece is display-only.
			const perPiece = quantity > 0 ? +(raw / quantity).toFixed(2) : 0;
			onPricingChange({ mode: "whole", perPiece, wholePrice: +raw.toFixed(2) });
		} else {
			onPricingChange({ mode: "per_piece", perPiece: +raw.toFixed(2), wholePrice: null });
		}
	};

	const switchMode = (next: PricingMode) => {
		if (next === mode) return;
		const current = parseFloat(priceStr) || 0;
		// Seed the new mode's keypad with a sensible starting value converted from the old one.
		const seeded = next === "whole"
			? (current > 0 ? +(current * quantity).toFixed(2) : 0)        // per-piece → whole total
			: (quantity > 0 && current > 0 ? +(current / quantity).toFixed(2) : 0); // whole → per-piece
		setPriceStr(seeded > 0 ? String(seeded) : "");
		setMode(next);
		report(next, seeded);
	};

	const apply = (next: string) => {
		setPriceStr(next);
		report(mode, parseFloat(next) || 0);
	};

	const pressKey = (k: string) => {
		if (k === "back") { apply(priceStr.slice(0, -1)); return; }
		if (k === ".") { if (!priceStr.includes(".")) apply(priceStr === "" ? "0." : priceStr + "."); return; }
		const dec = priceStr.split(".")[1];
		if (dec && dec.length >= 2) return;
		apply(priceStr === "0" ? k : priceStr + k);
	};

	const KEYS = ["7", "8", "9", "4", "5", "6", "1", "2", "3", ".", "0", "back"];

	const rawValue = parseFloat(priceStr) || 0;
	const perPiece = mode === "whole" ? (quantity > 0 ? rawValue / quantity : 0) : rawValue;
	const total = mode === "whole" ? rawValue : rawValue * quantity;

	return (
		<div className="fixed inset-0 z-60 bg-secondary/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
			<div className="bg-white rounded-3xl w-full max-w-xs shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
				{/* Header */}
				<div className="flex items-start justify-between gap-3 px-6 pt-6 pb-4">
					<div className="min-w-0">
						<p className="text-2.5 uppercase tracking-widest text-secondary/35 mb-1">Editing</p>
						<h3 className="text-lg font-bold text-secondary leading-snug">{name}</h3>
					</div>
					<button
						onClick={onClose}
						aria-label="Close"
						className="shrink-0 -mr-1 -mt-1 w-9 h-9 flex items-center justify-center rounded-full text-secondary/35 hover:text-secondary hover:bg-secondary/5 transition-colors"
					>
						<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
					</button>
				</div>

				{/* Mode toggle */}
				<div className="px-6 pb-3">
					<div className="flex rounded-xl bg-secondary/8 p-0.5 gap-0.5">
						<button
							onClick={() => switchMode("per_piece")}
							className={`flex-1 h-8 rounded-lg text-2.5 font-bold transition-all ${
								mode === "per_piece"
									? "bg-white shadow-sm text-secondary"
									: "text-secondary/40 hover:text-secondary/60"
							}`}
						>
							Per piece
						</button>
						<button
							onClick={() => switchMode("whole")}
							className={`flex-1 h-8 rounded-lg text-2.5 font-bold transition-all ${
								mode === "whole"
									? "bg-white shadow-sm text-secondary"
									: "text-secondary/40 hover:text-secondary/60"
							}`}
						>
							Whole price
						</button>
					</div>
				</div>

				{/* Amount display */}
				<div className="px-6">
					<div className="flex items-baseline justify-between border-b border-secondary/10 pb-3">
						<span className="text-2.5 uppercase tracking-widest text-secondary/35">
							{mode === "whole" ? `Total for ${quantity} pc${quantity !== 1 ? "s" : ""}` : "Selling price"}
						</span>
						<span className="flex items-baseline gap-1">
							<span className="text-xl font-semibold text-secondary/30">₱</span>
							<span className="text-4xl font-bold text-secondary tabular-nums leading-none">{priceStr || "0"}</span>
						</span>
					</div>
					<p className="text-right text-2.5 text-secondary/40 pt-2 tabular-nums">
						{mode === "whole" ? (
							<>= <span className="font-semibold text-secondary/70">₱{perPiece.toFixed(2)}</span> / pc</>
						) : (
							<>× {quantity} = <span className="font-semibold text-secondary/70">₱{total.toFixed(2)}</span></>
						)}
					</p>
				</div>

				{/* Keypad */}
				<div className="grid grid-cols-3 gap-1 px-4 pt-3">
					{KEYS.map((k) => (
						<button
							key={k}
							onClick={() => pressKey(k)}
							className="h-14 rounded-2xl flex items-center justify-center text-2xl font-medium text-secondary hover:bg-secondary/5 active:bg-secondary/10 transition-colors"
						>
							{k === "back" ? (
								<svg className="w-6 h-6 text-secondary/55" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
									<path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Z" />
									<path d="m15 9-6 6" />
									<path d="m9 9 6 6" />
								</svg>
							) : k}
						</button>
					))}
				</div>

				{/* Quantity stepper */}
				<div className="px-6 pt-3">
					<p className="text-2.5 uppercase tracking-widest text-secondary/35 mb-1.5">Quantity</p>
					<div className="flex items-center justify-between rounded-2xl border border-secondary/12 h-14 px-2">
						<button
							onClick={() => onQuantityChange(-1)}
							aria-label="Decrease quantity"
							className="w-11 h-11 flex items-center justify-center rounded-xl bg-accent/10 text-accent hover:bg-accent hover:text-primary active:scale-90 transition-all"
						>
							<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth={2.5} d="M5 12h14" /></svg>
						</button>
						<input
							type="text"
							inputMode="numeric"
							value={qtyStr}
							onChange={(e) => onQtyInput(e.target.value)}
							onFocus={(e) => e.target.select()}
							onBlur={() => { if (!qtyStr || parseInt(qtyStr, 10) < 1) setQtyStr(String(quantity)); }}
							aria-label="Quantity"
							className="w-16 text-center text-2xl font-bold text-secondary tabular-nums bg-transparent border-0 p-0 focus:outline-none focus:ring-0"
						/>
						<button
							onClick={() => onQuantityChange(1)}
							aria-label="Increase quantity"
							className="w-11 h-11 flex items-center justify-center rounded-xl bg-accent/10 text-accent hover:bg-accent hover:text-primary active:scale-90 transition-all"
						>
							<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth={2.5} d="M12 5v14M5 12h14" /></svg>
						</button>
					</div>
				</div>

				{/* Done */}
				<div className="px-5 pb-5 pt-3">
					<button
						onClick={onClose}
						className="w-full h-13 rounded-2xl bg-accent text-primary font-bold text-shadow-md hover:bg-accent/90 active:scale-[0.98] transition-all"
					>
						Done
					</button>
				</div>
			</div>
		</div>
	);
}
