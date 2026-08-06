// Temporary placeholder icon for the "admin" role badge — swap for a final design later.
export default function AdminIcon({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
			<path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
			<circle cx="12" cy="10.5" r="1.6" />
			<path d="M12 12.5v3.5" />
		</svg>
	);
}
