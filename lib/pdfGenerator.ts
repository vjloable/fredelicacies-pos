import type { OrderWithItems, WastageItemSummary, Discount } from "@/types/domain";

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
	discounts?: Discount[];
}

export async function generateSalesReportPDF(data: SalesReportData): Promise<void> {
	const { default: jsPDF } = await import("jspdf");
	const { default: autoTable } = await import("jspdf-autotable");

	const {
		branchName,
		period,
		periodLabel,
		analyticsOrders,
		topWastedItems,
		totalWastageCost,
		peakEntry,
		discounts = [],
	} = data;

	const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

	// ── Independent calculation (do not rely on currentPeriodStats) ───
	// Rules:
	//   - Voided orders are excluded regardless of payment method.
	//   - Revenue per order = order.total, except Grab which is order.total × 0.73.
	//   - COGS per order = Σ (item.cost × item.quantity).
	//   - Profit = Revenue − COGS.
	const activeOrders = analyticsOrders.filter(o => o.status !== 'voided');

	type PmKey = 'cash' | 'gcash' | 'grab' | 'debit_credit' | 'employee_charge';
	const pmMap: Record<PmKey, { orders: number; pieces: number; revenue: number }> = {
		cash: { orders: 0, pieces: 0, revenue: 0 },
		gcash: { orders: 0, pieces: 0, revenue: 0 },
		grab: { orders: 0, pieces: 0, revenue: 0 },
		debit_credit: { orders: 0, pieces: 0, revenue: 0 },
		employee_charge: { orders: 0, pieces: 0, revenue: 0 },
	};

	let totalPieces = 0;
	let totalCogs = 0;
	let grabGrossRevenue = 0;

	// GROSS revenue: pre-discount sales, Grab at 100%.
	// order.subtotal is the pre-discount value (already includes Grab uplift for Grab orders).
	let grossRevenue = 0;

	// NET revenue: post-discount sales, Grab netted to 73%.
	let netRevenue = 0;

	activeOrders.forEach(o => {
		const m = ((o.payment_method as string) || 'cash').toLowerCase() as PmKey;
		const pieces = o.items.reduce((s, i) => s + i.quantity, 0);
		const cogs = o.items.reduce((s, i) => s + (i.cost || 0) * i.quantity, 0);

		const orderGross = o.subtotal;
		const orderNet = m === 'grab' ? o.total * 0.73 : o.total;
		if (m === 'grab') grabGrossRevenue += o.total;

		totalPieces += pieces;
		totalCogs += cogs;
		grossRevenue += orderGross;
		netRevenue += orderNet;

		if (pmMap[m]) {
			pmMap[m].orders++;
			pmMap[m].pieces += pieces;
			pmMap[m].revenue += orderNet;
		}
	});

	const totalOrders = activeOrders.length;
	const grossProfit = netRevenue - totalCogs;
	const profitMargin = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;
	const avgOrderValue = totalOrders > 0 ? netRevenue / totalOrders : 0;

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
			['Gross Revenue', peso(grossRevenue)],
			['Net Revenue', peso(netRevenue)],
			['Gross Profit', peso(grossProfit)],
			['Profit Margin', `${profitMargin.toFixed(1)}%`],
			['Total Orders', totalOrders.toString()],
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

	const pmRows: string[][] = [];
	const pmLabels: [PmKey, string][] = [
		['cash', 'Cash'],
		['gcash', 'GCash'],
		['grab', 'Grab'],
		['debit_credit', 'Debit / Credit'],
		['employee_charge', 'Employee Charge'],
	];
	for (const [key, label] of pmLabels) {
		if (pmMap[key].orders === 0) continue;
		if (key === 'grab') {
			const fee = grabGrossRevenue - pmMap.grab.revenue;
			pmRows.push([
				label,
				pmMap[key].orders.toString(),
				pmMap[key].pieces.toString(),
				`${peso(grabGrossRevenue)}\n- ${peso(fee)} (27% fee)\n= ${peso(pmMap.grab.revenue)}`,
			]);
		} else {
			pmRows.push([label, pmMap[key].orders.toString(), pmMap[key].pieces.toString(), peso(pmMap[key].revenue)]);
		}
	}

	autoTable(doc, {
		startY: y,
		head: [['Method', 'Orders', 'Pieces', 'Revenue']],
		body: pmRows,
		theme: 'grid',
		headStyles: { fillColor: [218, 131, 77], fontSize: 7, fontStyle: 'bold' },
		bodyStyles: { fontSize: 7 },
		columnStyles: {
			0: { cellWidth: 38 },
			1: { cellWidth: 18, halign: 'right' },
			2: { cellWidth: 18, halign: 'right' },
			3: { halign: 'right' },
		},
		margin: { left: 14, right: 14 },
	});

	y = (doc as any).lastAutoTable.finalY + 5;

	// ── Orders ─────────────────────────────────────────────────────────
	doc.setFontSize(8);
	doc.setFont('helvetica', 'bold');
	doc.text('Orders', 14, y);
	y += 2;

	// Helper: build detailed discount cell text
	const discountCell = (order: OrderWithItems): string => {
		if (order.status === 'voided') return '—';
		if (!order.discount_id || !order.discount_amount) return '—';
		const disc = discounts.find(d => d.id === order.discount_id);
		if (!disc) return peso(order.discount_amount);

		const lines: string[] = [`-${peso(order.discount_amount)}`];
		if (disc.type === 'b1t1') {
			lines.push('Buy 1 Take 1');
		} else if (disc.type === 'sc_pwd') {
			const pct = disc.metadata?.discount_pct ?? 20;
			const vat = disc.metadata?.vat_rate ?? 12;
			const applyVat = disc.metadata?.apply_vat !== false;
			const mostExp = disc.metadata?.most_expensive_only !== false;
			lines.push(`SC/PWD ${pct}%${applyVat ? `+VAT${vat}%` : ''}`);
			lines.push(mostExp ? 'Most exp. item' : 'All items');
		} else if (disc.type === 'percentage') {
			lines.push(`${disc.name} (${disc.value}% off)`);
		} else {
			lines.push(`${disc.name} (-PHP ${disc.value})`);
		}
		return lines.join('\n');
	};

	// Helper: build detailed payment cell text
	const paymentCell = (order: OrderWithItems): string => {
		const pm = order.payment_method ?? 'cash';
		const d = order.payment_details;
		if (pm === 'debit_credit') {
			const parts = ['Debit/Credit'];
			if (d?.reference_no) parts.push(`Ref: ${d.reference_no}`);
			if (d?.transaction_no) parts.push(`Txn: ${d.transaction_no}`);
			if (d?.approval_code) parts.push(`Appr: ${d.approval_code}`);
			return parts.join('\n');
		}
		if (pm === 'employee_charge') {
			return d?.employee_name ? `Emp Charge\n${d.employee_name}` : 'Emp Charge';
		}
		if (pm === 'gcash') {
			return order.transaction_number ? `GCash\nTxn: ${order.transaction_number}` : 'GCash';
		}
		if (pm === 'grab') {
			return order.transaction_number ? `Grab\nTxn: ${order.transaction_number}` : 'Grab';
		}
		return 'Cash';
	};

	autoTable(doc, {
		startY: y,
		head: [['Order #', 'Date', 'Items', 'Subtotal', 'Discount', 'Total', 'Payment']],
		body: analyticsOrders.map(order => {
			const dt = new Date(order.created_at);
			const isVoided = order.status === 'voided';
			const itemsText = order.items.map(i => {
				const line = `${i.name} ×${i.quantity}`;
				// bundle_components is any; check for price override note stored in order_items
				const comp = i.bundle_components as any;
				const hasPriceOverride = comp?.isPriceOverride === true;
				const originalPrice = comp?.originalPrice as number | undefined;
				if (hasPriceOverride) {
					const orig = originalPrice !== undefined ? ` (orig: PHP ${originalPrice.toFixed(2)})` : '';
					return `${line}\n  ⚑ Price adjusted${orig}`;
				}
				return line;
			}).join('\n');
			return [
				order.order_number ?? order.id.slice(-8),
				dt.toLocaleDateString('en-PH', { month: '2-digit', day: '2-digit', year: '2-digit' })
					+ '\n' + dt.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true }),
				isVoided ? `${itemsText}\n[VOIDED]` : itemsText,
				isVoided ? '—' : peso(order.subtotal),
				discountCell(order),
				isVoided ? 'VOIDED' : peso(order.total),
				paymentCell(order),
			];
		}),
		theme: 'grid',
		headStyles: { fillColor: [218, 131, 77], fontSize: 7, fontStyle: 'bold' },
		bodyStyles: { fontSize: 6.5, valign: 'top' },
		columnStyles: {
			0: { cellWidth: 22 },
			1: { cellWidth: 18 },
			2: { cellWidth: 50 },
			3: { cellWidth: 20, halign: 'right' },
			4: { cellWidth: 28 },
			5: { cellWidth: 20, halign: 'right' },
			6: { cellWidth: 24 },
		},
		margin: { left: 14, right: 14 },
		didParseCell: (hookData) => {
			// Red text for voided rows in Total column
			if (hookData.column.index === 5 && hookData.cell.raw === 'VOIDED') {
				hookData.cell.styles.textColor = [200, 50, 50];
				hookData.cell.styles.fontStyle = 'bold';
			}
		},
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
