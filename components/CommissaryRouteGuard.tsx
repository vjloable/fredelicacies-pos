"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useBranch } from "@/contexts/BranchContext";

// Commissary branches have no Store/Sales; regular branches have no commissary Dashboard.
// Keep users out of routes that don't apply to the current branch type.
const COMMISSARY_BLOCKED = new Set(["store", "sales"]);

export default function CommissaryRouteGuard() {
	const { currentBranch } = useBranch();
	const pathname = usePathname();
	const router = useRouter();

	useEffect(() => {
		if (!currentBranch) return;
		const seg = pathname.split("/").filter(Boolean).pop() ?? "";
		const isCommissary = currentBranch.type === "commissary";

		if (isCommissary && COMMISSARY_BLOCKED.has(seg)) {
			router.replace(`/${currentBranch.id}/dashboard`);
		} else if (!isCommissary && seg === "dashboard") {
			router.replace(`/${currentBranch.id}/inventory`);
		}
	}, [currentBranch, pathname, router]);

	return null;
}
