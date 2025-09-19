import React from "react";
import AdminTopBar from "@/app/(admin)/components/AdminTopBar";
import BranchCard from "./components/BranchCard";
import styles from "./page.module.css";

const mockBranches = [
	{
		branchId: "b1",
		name: "Downtown",
		location: "123 Main St",
		createdAt: new Date("2024-01-10T09:00:00"),
		updatedAt: new Date("2025-09-01T12:00:00"),
		isActive: true,
		image: "/public/icons/home.svg",
	},
	{
		branchId: "b2",
		name: "Uptown",
		location: "456 Elm Ave",
		createdAt: new Date("2024-03-15T10:30:00"),
		updatedAt: new Date("2025-08-20T15:45:00"),
		isActive: false,
		image: "/public/icons/inventory.svg",
	},
	{
		branchId: "b3",
		name: "Suburb",
		location: "789 Oak Blvd",
		createdAt: new Date("2024-06-01T14:00:00"),
		updatedAt: new Date("2025-09-10T09:20:00"),
		isActive: true,
		image: "/public/icons/logs.svg",
	},
];

function formatDate(date: Date) {
	return (
		date.toLocaleDateString() +
		" " +
		date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
	);
}

export default function BranchesPage() {
	return (
		<div className='flex flex-col h-full'>
			<AdminTopBar title='Branches' />
			<div className='p-6'>
				<div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'>
					{mockBranches.map((branch) => (
						<BranchCard
							key={branch.branchId}
							branch={branch}
							formatDate={formatDate}
						/>
					))}
				</div>
			</div>
		</div>
	);
}
