export default function DashboardIcon({ className }: { className?: string }) {
	return (
		<svg
			width="49"
			height="48"
			viewBox="0 0 49 48"
			fill="currentColor"
			className={className}
		>
			<rect x="12" y="12" width="10" height="10" rx="2" fill="currentColor" />
			<rect x="26" y="12" width="10" height="6" rx="2" fill="currentColor" />
			<rect x="26" y="22" width="10" height="14" rx="2" fill="currentColor" />
			<rect x="12" y="26" width="10" height="10" rx="2" fill="currentColor" />
		</svg>
	);
}
