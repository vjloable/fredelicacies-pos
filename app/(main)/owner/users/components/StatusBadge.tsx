import React from "react";

interface StatusBadgeProps {
	status?: "clocked_in" | "clocked_out";
	isOwner?: boolean;
}

export default function StatusBadge({
	status,
	isOwner = false,
}: StatusBadgeProps) {
	// Owners don't have status tracking
	if (isOwner) {
		return (
			<span className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-accent/10 text-accent'>
				<div className='w-1.5 h-1.5 rounded-full mr-1.5 bg-accent' />
				Owner
			</span>
		);
	}

	const getStatusConfig = (status: string) => {
		switch (status) {
			case "clocked_in":
				return {
					label: "Clocked In",
					className: "bg-(--success)/10 text-(--success)",
					dotClassName: "bg-(--success)",
				};
			case "clocked_out":
				return {
					label: "Clocked Out",
					className: "bg-(--error)/10 text-(--error)",
					dotClassName: "bg-(--error)",
				};
			default:
				return {
					label: "Clocked Out",
					className: "bg-(--error)/10 text-(--error)",
					dotClassName: "bg-(--error)",
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
