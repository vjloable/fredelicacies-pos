// Temporary placeholder icon for the "cashier" role badge — swap for a final design later.
export default function CashierIcon({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
			<rect x="3.5" y="6.5" width="17" height="12" rx="1.5" />
			<circle cx="12" cy="12.5" r="2.25" />
			<path d="M3.5 9.5h2M18.5 9.5h2" />
		</svg>
	);
}
