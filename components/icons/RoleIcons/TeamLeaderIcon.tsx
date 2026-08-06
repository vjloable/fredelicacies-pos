// Temporary placeholder icon for the "team_leader" role badge — swap for a final design later.
export default function TeamLeaderIcon({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
			<circle cx="12" cy="7" r="3" />
			<path d="M12 4l1-2 1 1.5" />
			<path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" />
		</svg>
	);
}
