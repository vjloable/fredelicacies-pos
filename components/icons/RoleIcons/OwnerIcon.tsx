// Temporary placeholder icon for the "owner" role badge — swap for a final design later.
export default function OwnerIcon({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
			<path d="M4 8l3 3 5-6 5 6 3-3-1.5 9.5a1 1 0 01-1 .5H6.5a1 1 0 01-1-.5L4 8z" />
			<path d="M7 20h10" />
		</svg>
	);
}
