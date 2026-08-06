// Temporary placeholder icon for the "manager" role badge — swap for a final design later.
export default function ManagerIcon({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
			<rect x="3.5" y="8" width="17" height="11" rx="1.5" />
			<path d="M8.5 8V6a1.5 1.5 0 011.5-1.5h4A1.5 1.5 0 0115.5 6v2" />
			<path d="M3.5 12.5h17" />
		</svg>
	);
}
