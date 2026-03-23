import type { OrderWithItems, WastageItemSummary } from "@/types/domain";

export interface PeriodStats {
	totalRevenue: number;
	totalOrders: number;
	totalProfit: number;
	profitMargin: number;
}

export interface PeakPeriod {
	label: string;
	orders: number;
}

export interface SalesReportData {
	branchName: string;
	period: string;
	periodLabel: string;
	currentPeriodStats: PeriodStats;
	analyticsOrders: OrderWithItems[];
	topWastedItems: WastageItemSummary[];
	totalWastageCost: number;
	peakEntry: PeakPeriod | null;
}

export async function generateSalesReportPDF(data: SalesReportData): Promise<void> {
	const { default: jsPDF } = await import("jspdf");
	const { default: autoTable } = await import("jspdf-autotable");

	const {
		branchName,
		period,
		periodLabel,
		currentPeriodStats,
		analyticsOrders,
		topWastedItems,
		totalWastageCost,
		peakEntry,
	} = data;

	const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

	const avgOrderValue = currentPeriodStats.totalOrders > 0
		? currentPeriodStats.totalRevenue / currentPeriodStats.totalOrders
		: 0;
	const totalPieces = analyticsOrders.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0), 0);

	// Payment method breakdown
	const pmMap = { cash: { orders: 0, pieces: 0, revenue: 0 }, gcash: { orders: 0, pieces: 0, revenue: 0 }, grab: { orders: 0, pieces: 0, revenue: 0 } };
	analyticsOrders.forEach(o => {
		const m = ((o.payment_method as string) || 'cash').toLowerCase() as keyof typeof pmMap;
		if (pmMap[m]) {
			pmMap[m].orders++;
			pmMap[m].pieces += o.items.reduce((s, i) => s + i.quantity, 0);
			pmMap[m].revenue += o.total;
		}
	});

	const peso = (n: number) => `PHP ${n.toFixed(2)}`;
	let y = 12;

	// ── Header ─────────────────────────────────────────────────────────
	doc.setFontSize(14);
	doc.setFont('helvetica', 'bold');
	doc.text('FREDELECACIES', 105, y, { align: 'center' });
	y += 5;
	doc.setFontSize(9);
	doc.setFont('helvetica', 'normal');
	doc.text(`${branchName} — Sales Report`, 105, y, { align: 'center' });
	y += 4;
	doc.setFontSize(7);
	doc.setTextColor(100);
	doc.text(`Period: ${period}  |  Generated: ${new Date().toLocaleDateString()}`, 105, y, { align: 'center' });
	doc.setTextColor(0);
	y += 6;

	// ── Summary ────────────────────────────────────────────────────────
	doc.setFontSize(8);
	doc.setFont('helvetica', 'bold');
	doc.text('Summary', 14, y);
	y += 2;

	autoTable(doc, {
		startY: y,
		head: [['Metric', 'Value']],
		body: [
			['Total Revenue', peso(currentPeriodStats.totalRevenue)],
			['Total Profit', peso(currentPeriodStats.totalProfit)],
			['Profit Margin', `${currentPeriodStats.profitMargin.toFixed(1)}%`],
			['Total Orders', currentPeriodStats.totalOrders.toString()],
			['Total Pieces Sold', totalPieces.toString()],
			['Avg Order Value', peso(avgOrderValue)],
			['Wastage Cost', peso(totalWastageCost)],
			['Peak Period', peakEntry ? `${peakEntry.label} (${peakEntry.orders} orders)` : '-'],
		],
		theme: 'grid',
		headStyles: { fillColor: [218, 131, 77], fontSize: 7, fontStyle: 'bold' },
		bodyStyles: { fontSize: 7 },
		columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 }, 1: { halign: 'right', cellWidth: 50 } },
		margin: { left: 14, right: 14 },
	});

	y = (doc as any).lastAutoTable.finalY + 5;

	// ── Payment Methods ────────────────────────────────────────────────
	doc.setFontSize(8);
	doc.setFont('helvetica', 'bold');
	doc.text('Payment Methods', 14, y);
	y += 2;

	autoTable(doc, {
		startY: y,
		head: [['Method', 'Orders', 'Pieces', 'Revenue']],
		body: (['cash', 'gcash', 'grab'] as const).map(m => [
			m === 'gcash' ? 'GCash' : m === 'grab' ? 'Grab' : 'Cash',
			pmMap[m].orders.toString(),
			pmMap[m].pieces.toString(),
			peso(pmMap[m].revenue),
		]),
		theme: 'grid',
		headStyles: { fillColor: [218, 131, 77], fontSize: 7, fontStyle: 'bold' },
		bodyStyles: { fontSize: 7 },
		columnStyles: { 0: { cellWidth: 30 }, 1: { cellWidth: 20, halign: 'right' }, 2: { cellWidth: 20, halign: 'right' }, 3: { halign: 'right' } },
		margin: { left: 14, right: 14 },
	});

	y = (doc as any).lastAutoTable.finalY + 5;

	// ── Orders ─────────────────────────────────────────────────────────
	doc.setFontSize(8);
	doc.setFont('helvetica', 'bold');
	doc.text('Orders', 14, y);
	y += 2;

	autoTable(doc, {
		startY: y,
		head: [['Order #', 'Date', 'Items', 'Pcs', 'Total', 'Payment']],
		body: analyticsOrders.map(order => {
			const dt = new Date(order.created_at);
			const isVoided = order.status === 'voided';
			return [
				order.order_number ?? order.id.slice(-8),
				dt.toLocaleDateString(),
				order.items.map(i => `${i.name} x${i.quantity}`).join(', '),
				isVoided ? '0' : order.items.reduce((s, i) => s + i.quantity, 0).toString(),
				isVoided ? 'VOIDED' : peso(order.total),
				(order.payment_method ?? 'cash').toUpperCase(),
			];
		}),
		theme: 'grid',
		headStyles: { fillColor: [218, 131, 77], fontSize: 7, fontStyle: 'bold' },
		bodyStyles: { fontSize: 7 },
		columnStyles: {
			0: { cellWidth: 28 },
			1: { cellWidth: 18 },
			2: { cellWidth: 70 },
			3: { cellWidth: 10, halign: 'right' },
			4: { cellWidth: 28, halign: 'right' },
			5: { cellWidth: 18, halign: 'right' },
		},
		margin: { left: 14, right: 14 },
	});

	y = (doc as any).lastAutoTable.finalY + 5;

	// ── Wastage ────────────────────────────────────────────────────────
	if (topWastedItems.length > 0) {
		if (y > 260) { doc.addPage(); y = 12; }
		doc.setFontSize(8);
		doc.setFont('helvetica', 'bold');
		doc.text('Top Wasted Items', 14, y);
		y += 2;

		autoTable(doc, {
			startY: y,
			head: [['Item', 'Total Cost']],
			body: topWastedItems.map(w => [w.item_name, peso(w.total_cost)]),
			theme: 'grid',
			headStyles: { fillColor: [218, 131, 77], fontSize: 7, fontStyle: 'bold' },
			bodyStyles: { fontSize: 7 },
			columnStyles: { 1: { halign: 'right', cellWidth: 35 } },
			margin: { left: 14, right: 14 },
		});
	}

	// Save
	const filename = `sales_${periodLabel}_${branchName.replace(/\s+/g, '_')}.pdf`;
	doc.save(filename);
}
