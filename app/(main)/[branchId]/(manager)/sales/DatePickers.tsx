"use client";

import { useState, useRef, useEffect } from "react";

const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTHS_FULL = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS_SHORT = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function useOutsideClick(ref: React.RefObject<HTMLElement | null>, onClose: () => void) {
	useEffect(() => {
		const handler = (e: MouseEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node)) onClose();
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, [ref, onClose]);
}

// ── Day Picker ───────────────────────────────────────────────────────────────
interface DayPickerProps {
	value: string; // "YYYY-MM-DD"
	onChange: (val: string) => void;
}

export function DayPicker({ value, onChange }: DayPickerProps) {
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);
	useOutsideClick(ref, () => setOpen(false));

	const sel = value ? new Date(value + "T00:00:00") : new Date();
	const [viewYear, setViewYear] = useState(sel.getFullYear());
	const [viewMonth, setViewMonth] = useState(sel.getMonth());

	const today = new Date();
	today.setHours(0, 0, 0, 0);

	// Build calendar grid
	const firstDay = new Date(viewYear, viewMonth, 1).getDay();
	const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
	const daysInPrev = new Date(viewYear, viewMonth, 0).getDate();
	const cells: { day: number; month: "prev" | "cur" | "next" }[] = [];
	for (let i = firstDay - 1; i >= 0; i--)
		cells.push({ day: daysInPrev - i, month: "prev" });
	for (let d = 1; d <= daysInMonth; d++)
		cells.push({ day: d, month: "cur" });
	const remaining = 42 - cells.length;
	for (let d = 1; d <= remaining; d++)
		cells.push({ day: d, month: "next" });

	const handleSelect = (cell: (typeof cells)[number]) => {
		let y = viewYear, m = viewMonth;
		let d = cell.day;
		if (cell.month === "prev") { if (m === 0) { y--; m = 11; } else m--; }
		if (cell.month === "next") { if (m === 11) { y++; m = 0; } else m++; }
		onChange(`${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
		setOpen(false);
	};

	const prevMonth = () => { if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); } else setViewMonth(m => m - 1); };
	const nextMonth = () => { if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); } else setViewMonth(m => m + 1); };

	const label = sel
		? `${MONTHS_SHORT[sel.getMonth()]} ${String(sel.getDate()).padStart(2, "0")}, ${sel.getFullYear()}`
		: "Pick a date";

	return (
		<div className='relative' ref={ref}>
			<button
				onClick={() => setOpen(o => !o)}
				className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-3 font-medium transition-colors ${
					open
						? "bg-accent text-primary border-accent"
						: "bg-primary text-secondary border-secondary/20 hover:border-accent/50"
				}`}>
				<CalIcon />
				{label}
			</button>

			{open && (
				<div className='absolute top-full left-0 mt-1.5 z-50 w-64 bg-primary rounded-xl shadow-lg border border-secondary/10 p-3'>
					{/* Month nav */}
					<div className='flex items-center justify-between mb-3'>
						<button onClick={prevMonth} className='w-7 h-7 flex items-center justify-center rounded-lg hover:bg-accent/10 text-secondary/60 hover:text-accent transition-colors text-sm'>‹</button>
						<span className='text-3 font-semibold text-secondary'>{MONTHS_FULL[viewMonth]} {viewYear}</span>
						<button onClick={nextMonth} className='w-7 h-7 flex items-center justify-center rounded-lg hover:bg-accent/10 text-secondary/60 hover:text-accent transition-colors text-sm'>›</button>
					</div>

					{/* Day headers */}
					<div className='grid grid-cols-7 mb-1'>
						{DAYS_SHORT.map(d => (
							<div key={d} className='text-center text-2.5 font-semibold text-secondary/30 py-0.5'>{d}</div>
						))}
					</div>

					{/* Day cells */}
					<div className='grid grid-cols-7 gap-y-0.5'>
						{cells.map((cell, i) => {
							const cellDate = new Date(
								cell.month === "prev" ? (viewMonth === 0 ? viewYear - 1 : viewYear) : cell.month === "next" ? (viewMonth === 11 ? viewYear + 1 : viewYear) : viewYear,
								cell.month === "prev" ? (viewMonth === 0 ? 11 : viewMonth - 1) : cell.month === "next" ? (viewMonth === 11 ? 0 : viewMonth + 1) : viewMonth,
								cell.day
							);
							const isSelected = value === `${cellDate.getFullYear()}-${String(cellDate.getMonth() + 1).padStart(2, "0")}-${String(cellDate.getDate()).padStart(2, "0")}`;
							const isToday = cellDate.getTime() === today.getTime();
							const otherMonth = cell.month !== "cur";
							return (
								<button
									key={i}
									onClick={() => handleSelect(cell)}
									className={`w-full aspect-square flex items-center justify-center text-2.5 rounded-lg transition-colors ${
										isSelected
											? "bg-accent text-primary font-bold"
											: isToday
											? "border border-accent text-accent font-semibold hover:bg-accent/10"
											: otherMonth
											? "text-secondary/20 hover:text-secondary/40"
											: "text-secondary hover:bg-accent/10 hover:text-accent"
									}`}>
									{cell.day}
								</button>
							);
						})}
					</div>

					{/* Today shortcut */}
					<button
						onClick={() => {
							const t = new Date();
							onChange(`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`);
							setOpen(false);
						}}
						className='mt-2 w-full py-1.5 text-2.5 font-medium text-accent hover:bg-accent/10 rounded-lg transition-colors'>
						Today
					</button>
				</div>
			)}
		</div>
	);
}

// ── Month+Week Picker (for Week mode) ────────────────────────────────────────
interface WeekPickerProps {
	value: { week: number; month: number; year: number };
	onChange: (val: { week: number; month: number; year: number }) => void;
}

export function WeekPicker({ value, onChange }: WeekPickerProps) {
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);
	useOutsideClick(ref, () => setOpen(false));

	const [viewYear, setViewYear] = useState(value.year);

	const label = `${MONTHS_SHORT[value.month]} ${value.year} · W${value.week}`;

	return (
		<div className='flex items-center gap-2 flex-wrap'>
			{/* Month/year picker */}
			<div className='relative' ref={ref}>
				<button
					onClick={() => setOpen(o => !o)}
					className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-3 font-medium transition-colors ${
						open
							? "bg-accent text-primary border-accent"
							: "bg-primary text-secondary border-secondary/20 hover:border-accent/50"
					}`}>
					<CalIcon />
					{MONTHS_SHORT[value.month]} {value.year}
				</button>

				{open && (
					<div className='absolute top-full left-0 mt-1.5 z-50 w-56 bg-primary rounded-xl shadow-lg border border-secondary/10 p-3'>
						{/* Year nav */}
						<div className='flex items-center justify-between mb-3'>
							<button onClick={() => setViewYear(y => y - 1)} className='w-7 h-7 flex items-center justify-center rounded-lg hover:bg-accent/10 text-secondary/60 hover:text-accent transition-colors text-sm'>‹</button>
							<span className='text-3 font-semibold text-secondary'>{viewYear}</span>
							<button onClick={() => setViewYear(y => Math.min(new Date().getFullYear(), y + 1))} className='w-7 h-7 flex items-center justify-center rounded-lg hover:bg-accent/10 text-secondary/60 hover:text-accent transition-colors text-sm'>›</button>
						</div>

						{/* Month grid */}
						<div className='grid grid-cols-3 gap-1'>
							{MONTHS_SHORT.map((m, idx) => {
								const isSelected = value.month === idx && value.year === viewYear;
								const isFuture = viewYear > new Date().getFullYear() || (viewYear === new Date().getFullYear() && idx > new Date().getMonth());
								return (
									<button
										key={m}
										disabled={isFuture}
										onClick={() => { onChange({ ...value, month: idx, year: viewYear }); setOpen(false); }}
										className={`py-1.5 rounded-lg text-3 font-medium transition-colors ${
											isSelected
												? "bg-accent text-primary"
												: isFuture
												? "text-secondary/20 cursor-not-allowed"
												: "text-secondary hover:bg-accent/10 hover:text-accent"
										}`}>
										{m}
									</button>
								);
							})}
						</div>
					</div>
				)}
			</div>

			{/* W1–W4 buttons */}
			<div className='flex items-center gap-1'>
				{[1, 2, 3, 4].map((w) => (
					<button
						key={w}
						onClick={() => onChange({ ...value, week: w })}
						className={`w-9 h-8 flex items-center justify-center rounded-lg text-3 font-semibold transition-colors ${
							value.week === w
								? "bg-accent text-primary shadow-sm"
								: "bg-secondary/5 text-secondary/60 hover:bg-accent/10 hover:text-accent border border-secondary/10"
						}`}>
						W{w}
					</button>
				))}
			</div>
		</div>
	);
}

// ── Month Picker ─────────────────────────────────────────────────────────────
interface MonthPickerProps {
	value: { month: number; year: number };
	onChange: (val: { month: number; year: number }) => void;
}

export function MonthPicker({ value, onChange }: MonthPickerProps) {
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);
	useOutsideClick(ref, () => setOpen(false));

	const [viewYear, setViewYear] = useState(value.year);

	const label = `${MONTHS_SHORT[value.month]} ${value.year}`;

	return (
		<div className='relative' ref={ref}>
			<button
				onClick={() => setOpen(o => !o)}
				className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-3 font-medium transition-colors ${
					open
						? "bg-accent text-primary border-accent"
						: "bg-primary text-secondary border-secondary/20 hover:border-accent/50"
				}`}>
				<CalIcon />
				{label}
			</button>

			{open && (
				<div className='absolute top-full left-0 mt-1.5 z-50 w-52 bg-primary rounded-xl shadow-lg border border-secondary/10 p-3'>
					{/* Year nav */}
					<div className='flex items-center justify-between mb-3'>
						<button onClick={() => setViewYear(y => y - 1)} className='w-7 h-7 flex items-center justify-center rounded-lg hover:bg-accent/10 text-secondary/60 hover:text-accent transition-colors text-sm'>‹</button>
						<span className='text-3 font-semibold text-secondary'>{viewYear}</span>
						<button onClick={() => setViewYear(y => Math.min(new Date().getFullYear(), y + 1))} className='w-7 h-7 flex items-center justify-center rounded-lg hover:bg-accent/10 text-secondary/60 hover:text-accent transition-colors text-sm'>›</button>
					</div>

					{/* Month grid */}
					<div className='grid grid-cols-3 gap-1'>
						{MONTHS_SHORT.map((m, idx) => {
							const isSelected = value.month === idx && value.year === viewYear;
							const isFuture = viewYear > new Date().getFullYear() || (viewYear === new Date().getFullYear() && idx > new Date().getMonth());
							return (
								<button
									key={m}
									disabled={isFuture}
									onClick={() => { onChange({ month: idx, year: viewYear }); setOpen(false); }}
									className={`py-2 rounded-lg text-3 font-medium transition-colors ${
										isSelected
											? "bg-accent text-primary shadow-sm"
											: isFuture
											? "text-secondary/20 cursor-not-allowed"
											: "text-secondary hover:bg-accent/10 hover:text-accent"
									}`}>
									{m}
								</button>
							);
						})}
					</div>
				</div>
			)}
		</div>
	);
}

// ── Year Picker ──────────────────────────────────────────────────────────────
interface YearPickerProps {
	value: number;
	onChange: (val: number) => void;
}

export function YearPicker({ value, onChange }: YearPickerProps) {
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);
	useOutsideClick(ref, () => setOpen(false));

	const currentYear = new Date().getFullYear();
	// Show a range: past 8 years
	const years = Array.from({ length: 8 }, (_, i) => currentYear - 7 + i);

	return (
		<div className='relative' ref={ref}>
			<button
				onClick={() => setOpen(o => !o)}
				className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-3 font-medium transition-colors ${
					open
						? "bg-accent text-primary border-accent"
						: "bg-primary text-secondary border-secondary/20 hover:border-accent/50"
				}`}>
				<CalIcon />
				{value}
			</button>

			{open && (
				<div className='absolute top-full left-0 mt-1.5 z-50 w-44 bg-primary rounded-xl shadow-lg border border-secondary/10 p-2'>
					<div className='grid grid-cols-2 gap-1'>
						{years.map((y) => (
							<button
								key={y}
								onClick={() => { onChange(y); setOpen(false); }}
								className={`py-1.5 rounded-lg text-3 font-medium transition-colors ${
									value === y
										? "bg-accent text-primary shadow-sm"
										: "text-secondary hover:bg-accent/10 hover:text-accent"
								}`}>
								{y}
							</button>
						))}
					</div>
				</div>
			)}
		</div>
	);
}

// ── Shared icon ───────────────────────────────────────────────────────────────
function CalIcon() {
	return (
		<svg className='w-3 h-3 shrink-0' viewBox='0 0 16 16' fill='none' stroke='currentColor' strokeWidth='1.5'>
			<rect x='1' y='3' width='14' height='12' rx='2' />
			<path d='M1 7h14M5 1v4M11 1v4' strokeLinecap='round' />
		</svg>
	);
}
