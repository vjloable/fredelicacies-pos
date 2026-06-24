export default function DistributionIcon({ className }: { className?: string }) {
	return (
		<svg width="48" height="48" viewBox="0 0 48 48" fill="none" className={className}>
			{/* spokes from the main hub out to each branch */}
			<path
				d="M24 13L12 35M24 13L24 35M24 13L36 35"
				stroke="currentColor"
				strokeWidth="2.4"
				strokeLinecap="round"
			/>
			{/* main branch hub */}
			<circle cx="24" cy="12" r="5.5" fill="currentColor" />
			{/* destination branches */}
			<circle cx="12" cy="36" r="4" fill="currentColor" />
			<circle cx="24" cy="36" r="4" fill="currentColor" />
			<circle cx="36" cy="36" r="4" fill="currentColor" />
		</svg>
	);
}
