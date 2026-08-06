"use client";

import { useState } from "react";
import { useTimeTracking } from "@/contexts/TimeTrackingContext";
import ClockIcon from "@/components/icons/ClockIcon";

// Wraps POS content that's locked until the cashier/TL clocks in. Instead of
// blurring the content into illegibility, it dims it under a light dark
// overlay (still readable, clearly inert) and floats a single "Clock In"
// call-to-action in the center — an explicit, actionable prompt rather than
// a vague blur the user has to guess the meaning of.
export default function ClockInGate({
	active,
	branchId,
	className = "",
	// Show the floating "Clock In" CTA. Set false on smaller companion regions
	// (e.g. a search bar above the main gated area) so only one button shows
	// per screen instead of one per dimmed section.
	showButton = true,
	children,
}: {
	// true = gate is showing (i.e. !canAccessPOS)
	active: boolean;
	branchId?: string;
	className?: string;
	showButton?: boolean;
	children: React.ReactNode;
}) {
	const { clockIn } = useTimeTracking();
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	if (!active) return <div className={className}>{children}</div>;

	const handleClockIn = async () => {
		if (!branchId || loading) return;
		setLoading(true);
		setError(null);
		try {
			await clockIn(branchId);
		} catch (err: any) {
			setError(err.message || "Failed to clock in");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className={`relative ${className}`}>
			<div className="pointer-events-none select-none opacity-90">{children}</div>
			{showButton && (
				<div className="absolute inset-0 bg-black/10 flex items-center justify-center p-4">
					<div className="flex flex-col items-center gap-3 text-center">
						<div className="relative">
							<span className="absolute inset-0 rounded-full bg-accent/40 animate-ping" />
							<button
								onClick={handleClockIn}
								disabled={loading || !branchId}
								className="relative flex items-center gap-2 px-6 py-3.5 rounded-full bg-accent text-primary font-black text-3 uppercase tracking-wide shadow-lg hover:bg-accent/90 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
							>
								<ClockIcon className="w-5 h-5" />
								{loading ? "Clocking in…" : "Clock In to Continue"}
							</button>
						</div>
						{error && (
							<p className="text-xs text-error font-semibold bg-white shadow-sm px-3 py-1.5 rounded-lg">{error}</p>
						)}
					</div>
				</div>
			)}
			{!showButton && <div className="absolute inset-0 bg-black/10" />}
		</div>
	);
}
