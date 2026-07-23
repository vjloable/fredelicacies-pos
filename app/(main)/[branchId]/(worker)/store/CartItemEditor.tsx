"use client";

import { useEffect, useState } from "react";

// Touch-friendly editor for a cart line: calculator keypad for the selling price + a quantity stepper.
export default function CartItemEditor({
	name,
	price,
	quantity,
	onPriceChange,
	onQuantityChange,
	onClose,
}: {
	name: string;
	price: number;
	quantity: number;
	onPriceChange: (value: number) => void;
	onQuantityChange: (delta: number) => void;
	onClose: () => void;
}) {
	const [priceStr, setPriceStr] = useState(price ? String(price) : "");

	// Editable quantity that stays in sync with the ± stepper.
	const [qtyStr, setQtyStr] = useState(String(quantity));
	useEffect(() => { setQtyStr(String(quantity)); }, [quantity]);
	const onQtyInput = (v: string) => {
		if (!/^\d*$/.test(v)) return;
		setQtyStr(v);
		const n = parseInt(v, 10);
		if (Number.isFinite(n) && n >= 1 && n !== quantity) onQuantityChange(n - quantity);
	};

	const apply = (next: string) => {
		setPriceStr(next);
		onPriceChange(parseFloat(next) || 0);
	};

	const pressKey = (k: string) => {
		if (k === "back") { apply(priceStr.slice(0, -1)); return; }
		if (k === ".") { if (!priceStr.includes(".")) apply(priceStr === "" ? "0." : priceStr + "."); return; }
		const dec = priceStr.split(".")[1];
		if (dec && dec.length >= 2) return;
		apply(priceStr === "0" ? k : priceStr + k);
	};

	const KEYS = ["7", "8", "9", "4", "5", "6", "1", "2", "3", ".", "0", "back"];
	const total = (parseFloat(priceStr) || 0) * quantity;

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

				{/* Amount */}
				<div className="px-6">
					<div className="flex items-baseline justify-between border-b border-secondary/10 pb-3">
						<span className="text-2.5 uppercase tracking-widest text-secondary/35">Selling price</span>
						<span className="flex items-baseline gap-1">
							<span className="text-xl font-semibold text-secondary/30">₱</span>
							<span className="text-4xl font-bold text-secondary tabular-nums leading-none">{priceStr || "0"}</span>
						</span>
					</div>
					<p className="text-right text-2.5 text-secondary/40 pt-2 tabular-nums">
						× {quantity} = <span className="font-semibold text-secondary/70">₱{total.toFixed(2)}</span>
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
