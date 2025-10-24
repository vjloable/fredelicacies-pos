import React from "react";

interface StatusBadgeProps {
	status?: "clocked_in" | "clocked_out";
	isAdmin?: boolean;
}

export default function StatusBadge({
	status,
	isAdmin = false,
}: StatusBadgeProps) {
	// Admins don't have status tracking
	if (isAdmin) {
		return (
			<span className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--accent)]/10 text-[var(--accent)]'>
				<div className='w-1.5 h-1.5 rounded-full mr-1.5 bg-[var(--accent)]' />
				Admin
			</span>
		);
	}

	const getStatusConfig = (status: string) => {
		switch (status) {
			case "clocked_in":
				return {
					label: "Clocked In",
					className: "bg-[var(--success)]/10 text-[var(--success)]",
					dotClassName: "bg-[var(--success)]",
				};
			case "clocked_out":
				return {
					label: "Clocked Out",
					className: "bg-[var(--error)]/10 text-[var(--error)]",
					dotClassName: "bg-[var(--error)]",
				};
			default:
				return {
					label: "Clocked Out",
					className: "bg-[var(--error)]/10 text-[var(--error)]",
					dotClassName: "bg-[var(--error)]",
				};
		}
	};

	const config = getStatusConfig(status || "clocked_out");

	return (
		<span
			className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
			<div
				className={`w-1.5 h-1.5 rounded-full mr-1.5 ${config.dotClassName}`}
			/>
			{config.label}
		</span>
	);
}
