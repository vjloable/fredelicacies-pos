"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import TopBar from "@/components/TopBar";
import MobileTopBar from "@/components/MobileTopBar";
import EditItemModal from "./components/EditItemModal";
import AddItemModal from "./components/AddItemModal";
import AddCategoryModal from "./components/AddCategoryModal";
import BundlesView from "./components/BundlesView";
import LockItemModal from "./components/LockItemModal";
import SubmitEODModal from "./components/SubmitEODModal";
import AuditConfigModal from "./components/AuditConfigModal";
import PublishMenuModal from "./components/PublishMenuModal";
import type { InventoryItem, Category } from "@/types/domain";
import type { EodItemLock, EodSession } from "@/types/domain/eod";
import { subscribeToInventoryItems, updateInventoryItem } from "@/services/inventoryService";
import { logActivity } from "@/services/activityLogService";
import { recordWastage } from "@/services/wastageService";
import { subscribeToEodLocks, getEodLocks, resolveUncarried, submitEOD, lockItem } from "@/services/eodService";
import { categoryEodPolicyRepository } from "@/lib/repositories/categoryEodPolicyRepository";
import type { CategoryEodPolicy } from "@/types/domain/category";
import { useAuth } from "@/contexts/AuthContext";
import {
	subscribeToCategories,
	getCategoryColor,
	deleteCategory,
	updateCategory,
} from "@/services/categoryService";
import { useBranch } from "@/contexts/BranchContext";
import { useDateTime } from "@/contexts/DateTimeContext";
import HelpButton from "@/components/HelpButton";
import { inventorySteps } from "@/components/TutorialSteps";
import EditIcon from "../store/icons/EditIcon";
import PlusIcon from "../../../../../components/icons/PlusIcon";
import DeleteIcon from "../store/icons/DeleteIcon";
import { formatCurrency } from "@/lib/currency_formatter";
import EmptyInventory from "./illustrations/EmptyInventory";
import InventoryIcon from "@/components/icons/SidebarNav/InventoryIcon";
import LoadingSpinner from "@/components/LoadingSpinner";
import { usePOSAccessControl } from "@/contexts/TimeTrackingContext";

interface Item extends InventoryItem {
	id: string;
}

export default function InventoryScreen() {
	const { currentBranch, refreshBranches, availableBranches } = useBranch();
	const { user } = useAuth();
	const { date: todayFormatted } = useDateTime();
	const [categories, setCategories] = useState<Category[]>([]);
	const [items, setItems] = useState<Item[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [isClient, setIsClient] = useState(false);
	const { canAccessPOS } = usePOSAccessControl(currentBranch?.id);
	const [activeTab, setActiveTab] = useState<'items' | 'bundles'>('items');
	const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
	const UNCAT = '__uncategorized__'; // sentinel folder for items with no category
	const [inventorySearch, setInventorySearch] = useState('');
	const [showCategoryForm, setShowCategoryForm] = useState(false);
	const [editingCategory, setEditingCategory] = useState<Category | null>(null);
	const [showItemForm, setShowItemForm] = useState(false);
	const [showEditModal, setShowEditModal] = useState(false);
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
	const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
	const [editingItem, setEditingItem] = useState<Item | null>(null);
	const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
	const [destockMode, setDestockMode] = useState(false);
	const [manageCategories, setManageCategories] = useState(false);
	const [selectedForDestock, setSelectedForDestock] = useState<Set<string>>(new Set());
	const [showDestockConfirm, setShowDestockConfirm] = useState(false);
	const [destocking, setDestocking] = useState(false);
	// EOD state
	const [eodLocks, setEodLocks] = useState<EodItemLock[]>([]);
	const [eodSession, setEodSession] = useState<EodSession | null>(null);
	const [eodPanelOpen, setEodPanelOpen] = useState(true);
	const [lockingItem, setLockingItem] = useState<Item | null>(null);
	const [showSubmitEOD, setShowSubmitEOD] = useState(false);
	// EOD policy state
	const [eodPolicies, setEodPolicies] = useState<CategoryEodPolicy[]>([]);
	// Uncarried stock resolution state
	const [resolveMode, setResolveMode] = useState(false);
	const [selectedForResolve, setSelectedForResolve] = useState<Set<string>>(new Set());
	const [resolving, setResolving] = useState(false);
	// Audit config & inline audit state
	const [showAuditConfigModal, setShowAuditConfigModal] = useState(false);
	const [showPublishModal, setShowPublishModal] = useState(false);
	const [auditMode, setAuditMode] = useState(false);
	const [auditInputs, setAuditInputs] = useState<Record<string, string>>({});
	const [auditResolutions, setAuditResolutions] = useState<Record<string, { type: 'force_carryover' | 'force_wastage'; reason: string } | null>>({});
	const [lockingAudit, setLockingAudit] = useState(false);
	const [showCarryOverAllConfirm, setShowCarryOverAllConfirm] = useState(false);

	// Derived: owner check & audit category
	const isOwner = user?.is_owner ?? false;
	const auditCategoryId = currentBranch?.audit_category_id ?? null;
	const auditCategoryItems = auditCategoryId
		? items.filter(item => item.category_id === auditCategoryId)
		: [];
	const allAuditItemsLocked = auditCategoryItems.length > 0 &&
		auditCategoryItems.every(item => eodLocks.some(l => l.item_id === item.id));

	useEffect(() => {
		setIsClient(true);
	}, []);

	useEffect(() => {
		if (!isClient || !currentBranch) return;

		const unsubscribe = subscribeToCategories(currentBranch.id, (cats: Category[]) => {
			setCategories(cats);
		});

		return () => { if (unsubscribe) unsubscribe(); };
	}, [isClient, currentBranch?.id]);

	useEffect(() => {
		if (!isClient || !currentBranch) return;

		setLoading(true);
		setError(null);

		const unsubscribe = subscribeToInventoryItems(
			currentBranch.id,
			(items: InventoryItem[]) => {
				setItems(items.map((item: InventoryItem) => ({ ...item, id: item.id! })));
				setLoading(false);
			}
		);

		const timeoutId = setTimeout(() => { setLoading(false); }, 15000);

		return () => {
			clearTimeout(timeoutId);
			if (unsubscribe) unsubscribe();
		};
	}, [isClient, currentBranch]);

	// Subscribe to today's EOD locks (owner only)
	useEffect(() => {
		if (!isClient || !currentBranch || !canAccessPOS || !isOwner) return;
		const today = new Date().toISOString().slice(0, 10);
		// Fetch session too on mount
		getEodLocks(currentBranch.id, today).then(({ session }) => setEodSession(session));
		const unsubscribe = subscribeToEodLocks(currentBranch.id, today, setEodLocks);
		return () => { unsubscribe(); };
	}, [isClient, currentBranch, canAccessPOS, isOwner]);

	// Subscribe to EOD policies
	useEffect(() => {
		if (!isClient || !currentBranch) return;
		const unsubscribe = categoryEodPolicyRepository.subscribe(currentBranch.id, setEodPolicies);
		return () => { unsubscribe(); };
	}, [isClient, currentBranch?.id]);

	// Helper: check if a category requires EOD audit
	const requiresEodAudit = (categoryId: string | null): boolean => {
		if (!categoryId) return false;
		if (auditCategoryId) return categoryId === auditCategoryId;
		return eodPolicies.some(p => p.category_id === categoryId && p.eod_policy === 'carryover');
	};

	// Toggle resolve selection
	const toggleResolveSelection = (id: string) => {
		setSelectedForResolve(prev => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id); else next.add(id);
			return next;
		});
	};

	// Resolve selected uncarried items
	const confirmResolve = async (resolution: 'carry_over' | 'destock') => {
		if (!currentBranch || selectedForResolve.size === 0) return;
		setResolving(true);
		const selectedItems = items.filter(item => selectedForResolve.has(item.id));
		await resolveUncarried(currentBranch.id, user?.id ?? null, selectedItems, resolution);
		setResolving(false);
		setSelectedForResolve(new Set());
		setResolveMode(false);
	};

	// Toggle audit mode — initialize inputs for unlocked audit items
	const toggleAuditMode = () => {
		if (auditMode) {
			setAuditMode(false);
			setAuditInputs({});
			setAuditResolutions({});
		} else {
			const inputs: Record<string, string> = {};
			const resolutions: Record<string, null> = {};
			for (const item of auditCategoryItems) {
				if (!eodLocks.some(l => l.item_id === item.id)) {
					inputs[item.id] = '';
					resolutions[item.id] = null;
				}
			}
			setAuditInputs(inputs);
			setAuditResolutions(resolutions);
			setAuditMode(true);
		}
	};

	// Lock all audited items
	const handleLockAllAudit = async () => {
		if (!currentBranch) return;
		setLockingAudit(true);

		for (const item of auditCategoryItems) {
			if (eodLocks.some(l => l.item_id === item.id)) continue; // already locked
			const input = auditInputs[item.id];
			if (input === '' || input === undefined) continue;
			const expectedStock = parseInt(input) || 0;
			const discrepancy = item.stock - expectedStock;
			const resolution = discrepancy !== 0 ? auditResolutions[item.id] ?? undefined : undefined;
			const resolutionArg = resolution
				? { type: resolution.type, reason: resolution.reason || undefined }
				: undefined;

			const { error } = await lockItem(currentBranch.id, user?.id ?? null, item, expectedStock, resolutionArg);
			if (error) {
				setLockingAudit(false);
				handleError(`Failed to lock "${item.name}". Please try again.`);
				return;
			}
		}

		setLockingAudit(false);
		setAuditMode(false);
		setAuditInputs({});
		setAuditResolutions({});
		// Refresh session
		if (!eodSession) getEodLocks(currentBranch.id, new Date().toISOString().slice(0, 10)).then(({ session }) => setEodSession(session));
	};

	// Check if all audit inputs are ready to lock
	const allAuditInputsReady = auditCategoryItems.every(item => {
		if (eodLocks.some(l => l.item_id === item.id)) return true; // already locked
		const input = auditInputs[item.id];
		if (input === '' || input === undefined) return false;
		const expectedStock = parseInt(input) || 0;
		const discrepancy = item.stock - expectedStock;
		if (discrepancy !== 0 && !auditResolutions[item.id]) return false;
		if (auditResolutions[item.id]?.type === 'force_carryover' && !auditResolutions[item.id]?.reason?.trim()) return false;
		return true;
	});

	const openEditModal = (item: InventoryItem) => {
		setEditingItem({ ...item });
		setShowEditModal(true);
	};

	const closeEditModal = () => {
		setShowEditModal(false);
		setEditingItem(null);
	};

	const handleError = (errorMessage: string) => {
		setError(errorMessage);
	};

	const handleDeleteCategory = (category: Category) => {
		const categoryItems = items.filter((item) => item.category_id === category.id);
		if (categoryItems.length > 0) {
			setError(
				`Cannot delete category "${category.name}" because it has ${categoryItems.length} item${categoryItems.length > 1 ? "s" : ""}. Please move or delete all items in this category first.`
			);
			return;
		}
		setCategoryToDelete(category);
		setShowDeleteConfirm(true);
	};

	const confirmDeleteCategory = async () => {
		if (!categoryToDelete?.id) return;
		try {
			await deleteCategory(categoryToDelete.id);
			if (activeCategoryId === categoryToDelete.id) setActiveCategoryId(null);
			setShowDeleteConfirm(false);
			setCategoryToDelete(null);
		} catch (error) {
			console.error("Error deleting category:", error);
			setError("Failed to delete category. Please try again.");
		}
	};

	const cancelDeleteCategory = () => {
		setShowDeleteConfirm(false);
		setCategoryToDelete(null);
	};

	const toggleCategoryVisibility = async (cat: Category) => {
		await updateCategory(cat.id!, { is_hidden: !cat.is_hidden });
	};

	const toggleExpandItem = (id: string) => {
		setExpandedItems(prev => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id); else next.add(id);
			return next;
		});
	};

	const toggleDestockSelection = (id: string) => {
		setSelectedForDestock(prev => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id); else next.add(id);
			return next;
		});
	};

	const confirmDestock = async () => {
		if (!currentBranch || selectedForDestock.size === 0) return;
		setDestocking(true);
		const selectedItems = items.filter(item => selectedForDestock.has(item.id));
		const wastageItems: { item_id: string; item_name: string; quantity_wasted: number; cost_per_unit: number }[] = [];
		for (const item of selectedItems) {
			const oldStock = item.stock;
			const { error: updateError } = await updateInventoryItem(item.id, { stock: 0 });
			if (!updateError && oldStock > 0) {
				void logActivity({
					branchId: currentBranch.id,
					userId: user?.id ?? null,
					action: 'stock_removed',
					entityType: 'inventory',
					entityId: item.id,
					details: { item_name: item.name, old_stock: oldStock, new_stock: 0, delta: oldStock },
				});
				wastageItems.push({ item_id: item.id, item_name: item.name, quantity_wasted: oldStock, cost_per_unit: item.price });
			}
		}
		if (wastageItems.length > 0) {
			void recordWastage(currentBranch.id, user?.id ?? null, wastageItems);
		}
		setDestocking(false);
		setShowDestockConfirm(false);
		setSelectedForDestock(new Set());
		setDestockMode(false);
	};

	// Filtered items based on active category (null = folder grid, no item list)
	const filteredItems = activeCategoryId
		? (activeCategoryId === UNCAT
			? items.filter(item => !item.category_id)
			: items.filter(item => item.category_id === activeCategoryId))
		: [];

	// Global item search (breadcrumb directory results) across every category.
	const invQ = inventorySearch.trim().toLowerCase();
	const searchResults = invQ
		? items.filter(item => {
			const catName = categories.find(c => c.id === item.category_id)?.name ?? 'Uncategorized';
			return item.name.toLowerCase().includes(invQ)
				|| (item.barcode ?? '').toLowerCase().includes(invQ)
				|| catName.toLowerCase().includes(invQ);
		})
		: [];

	// Items in current folder that have uncarried stock (for folder-scoped RESOLVE)
	const folderUncarriedItems = filteredItems.filter(item => item.uncarried_stock > 0);

	// Back handler: return to grid and exit all modes
	const handleBackToGrid = () => {
		setActiveCategoryId(null);
		setDestockMode(false);
		setSelectedForDestock(new Set());
		setResolveMode(false);
		setSelectedForResolve(new Set());
		setAuditMode(false);
		setAuditInputs({});
		setAuditResolutions({});
	};

	const inventorySearchUI = (
		<>
{/* Item search */}
										<div className="relative mb-4">
											<svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary/40 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
											</svg>
											<input
												type="text"
												value={inventorySearch}
												onChange={(e) => setInventorySearch(e.target.value)}
												placeholder="Search items across all categories…"
												className="w-full h-11 pl-10 pr-9 text-3 rounded-lg border border-secondary/20 bg-white focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
											/>
											{inventorySearch && (
												<button
													onClick={() => setInventorySearch('')}
													aria-label="Clear search"
													className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 inline-flex items-center justify-center rounded-md text-secondary/40 hover:text-secondary hover:bg-secondary/10 transition-colors"
												>
													<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
												</button>
											)}
										</div>

										{/* Search results: breadcrumb directory list */}
										{inventorySearch.trim() && (
											searchResults.length === 0 ? (
												<div className="py-16 text-center">
													<p className="text-sm font-medium text-secondary mb-1">No items found</p>
													<p className="text-xs text-secondary/50">Nothing matches &ldquo;{inventorySearch.trim()}&rdquo;.</p>
												</div>
											) : (
												<div>
													<p className="text-2.5 text-secondary/40 mb-1">{searchResults.length} {searchResults.length === 1 ? 'result' : 'results'}</p>
													<div className="divide-y divide-secondary/10 border-y border-secondary/10">
														{searchResults.map((item) => {
															const cat = categories.find(c => c.id === item.category_id);
															const catName = cat?.name ?? 'Uncategorized';
															const catColor = cat?.color?.trim() || '#9CA3AF';
															return (
																<button
																	key={item.id}
																	onClick={() => openEditModal(item)}
																	className="group w-full flex items-center gap-3 py-3 text-left transition-colors hover:bg-accent/5 focus-visible:outline-none"
																>
																	<div className="w-9 h-9 rounded-md bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
																		{item.img_url ? (
																			<Image src={item.img_url} alt={item.name} width={36} height={36} className="w-full h-full object-cover" />
																		) : (
																			<svg className="w-4 h-4 text-gray-300" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" /></svg>
																		)}
																	</div>
																	<nav aria-label="Breadcrumb" className="flex items-center gap-1.5 min-w-0 flex-1">
																		<span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: catColor }} />
																		<span className="text-2.5 font-medium text-secondary/50 truncate shrink min-w-0">{catName}</span>
																		<svg className="w-3 h-3 shrink-0 text-secondary/30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
																		<span className="text-sm font-semibold text-secondary truncate">{item.name}</span>
																	</nav>
																	<span className="shrink-0 text-xs font-bold tabular-nums text-secondary/60">{item.stock}</span>
																</button>
															);
														})}
													</div>
												</div>
											)
										)}
		</>
	);

	return (
		<div className='flex h-full overflow-hidden'>
			{/* Main Content Area */}
			<div className='flex flex-col flex-1 min-w-0 h-full overflow-hidden'>
				{/* Mobile TopBar */}
				<div className='xl:hidden w-full'>
					<MobileTopBar title='Inventory' icon={<InventoryIcon />} rightAction={<HelpButton variant='page' steps={inventorySteps} />} />
				</div>
				{/* Desktop TopBar */}
				<div className='hidden xl:block w-full'>
					<TopBar title='Inventory' icon={<InventoryIcon />} rightAction={<HelpButton variant='page' steps={inventorySteps} />} />
				</div>
				<span className='flex h-6'></span>

				{!isClient ? (
					<div className='flex items-center justify-center py-8'>
						<LoadingSpinner size="md"/>
						<span className='ml-3 text-secondary'>Initializing...</span>
					</div>
				) : (
					<>
						{error && (
							<div className='mx-6 mb-4 p-2 bg-error/10 border border-error/40 rounded-lg'>
								<div className='flex items-center gap-3'>
									<svg className='w-5 h-5 text-error' fill='currentColor' viewBox='0 0 20 20'>
										<path fillRule='evenodd' d='M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z' clipRule='evenodd' />
									</svg>
									<span className='text-error font-medium text-3'>{error}</span>
									<button onClick={() => setError(null)} className='ml-auto text-error hover:text-error/20'>
										<DeleteIcon />
									</button>
								</div>
							</div>
						)}

						{loading && (
							<div className='flex items-center justify-center py-8'>
								<LoadingSpinner size="md"/>
								<span className='ml-3 text-secondary'>Loading inventory...</span>
							</div>
						)}

						{!loading && (
							<div className='flex-1 px-6 overflow-y-auto pb-6'>
								{/* Tab Navigation */}
								<div className='flex gap-2 mb-4'>
									<button
										onClick={() => setActiveTab('items')}
										className={`px-4 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide transition-all ${
											activeTab === 'items'
												? 'bg-accent text-primary text-shadow-lg'
												: 'bg-gray-200 text-secondary hover:bg-gray-300'
										}`}
									>
										Pieces
									</button>
									<button
										onClick={() => setActiveTab('bundles')}
										className={`px-4 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide transition-all ${
											activeTab === 'bundles'
												? 'bg-amber-500 text-white'
												: 'bg-gray-200 text-secondary hover:bg-gray-300'
										}`}
									>
										Bundles
									</button>
								</div>

								{/* Items View */}
								{activeTab === 'items' && (
									<>
										{/* Level 0: Folder Grid — shown when no category is selected */}
										{activeCategoryId === null && (
											<div>
												{/* Grid-level toolbar */}
												<div className='flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-end gap-2 mb-4'>
													<button
														onClick={() => { setEditingCategory(null); setShowCategoryForm(true); }}
														className={`h-12 px-4 flex items-center gap-2 rounded-lg shadow-sm font-black text-3 transition-all hover:scale-105 active:scale-95 bg-accent hover:bg-accent/90 ${!canAccessPOS ? 'blur-[1px] pointer-events-none' : ''}`}
													>
														<div className='size-4 text-primary drop-shadow-lg'>
															<PlusIcon />
														</div>
														<span className='text-primary text-shadow-md'>ADD CATEGORY</span>
													</button>
													{/* Manage categories toggle */}
													{categories.length > 0 && (
														<button
															onClick={() => setManageCategories(prev => !prev)}
															className={`h-12 px-4 flex items-center gap-2 rounded-lg shadow-sm font-black text-3 transition-all hover:scale-105 active:scale-95
																${!canAccessPOS ? 'blur-[1px] pointer-events-none' : ''}
																${manageCategories ? 'bg-secondary text-white' : 'bg-secondary/10 text-secondary hover:bg-secondary/20'}`}
														>
															<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
																<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' />
															</svg>
															<span>{manageCategories ? 'DONE' : 'MANAGE'}</span>
														</button>
													)}
													{/* Publish Menu (owner, commissary branch only) */}
													{isOwner && currentBranch?.type === 'commissary' && (
														<button
															onClick={() => setShowPublishModal(true)}
															className={`h-12 px-4 flex items-center gap-2 rounded-lg shadow-sm font-black text-3 transition-all hover:scale-105 active:scale-95 bg-bundle/10 text-bundle hover:bg-bundle/20 ${!canAccessPOS ? 'blur-[1px] pointer-events-none' : ''}`}
															title="Copy this branch's menu to other branches"
														>
															<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
																<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 19V5m0 0l-5 5m5-5l5 5' />
															</svg>
															<span>PUBLISH MENU</span>
														</button>
													)}
													{/* Audit config cog (owner only) */}
													{isOwner && (
														<button
															onClick={() => setShowAuditConfigModal(true)}
															className={`h-12 w-12 shrink-0 flex items-center justify-center rounded-lg transition-all hover:scale-105 active:scale-95 hover:bg-secondary/10 text-secondary/40 hover:text-secondary ${!canAccessPOS ? 'blur-[1px] pointer-events-none' : ''}`}
															title='Audit Configuration'
														>
															<svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
																<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' />
																<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15 12a3 3 0 11-6 0 3 3 0 016 0z' />
															</svg>
														</button>
													)}
												</div>

												{inventorySearchUI}

												{/* Category folder grid */}
												{inventorySearch.trim() ? null : categories.length === 0 ? (
													<div className='text-center py-16 px-4'>
														<div className='w-90 mb-4 mx-auto opacity-50 flex items-center justify-center'>
															<EmptyInventory />
														</div>
														<h3 className='text-4 font-semibold text-secondary mb-3'>No Categories Yet</h3>
														<p className='w-75 text-3 text-secondary opacity-70 mb-6 max-w-md mx-auto'>
															Start by creating your first category to organise your inventory.
														</p>
														<button
															onClick={() => { setEditingCategory(null); setShowCategoryForm(true); }}
															className='text-3 inline-flex items-center gap-2 bg-accent text-white px-6 py-3 rounded-lg hover:bg-accent/90 transition-all font-black text-shadow-lg hover:scale-105 active:scale-95'
														>
															<PlusIcon className='w-4 h-4 drop-shadow-md' />
															<span className='mt-0.5'>ADD YOUR FIRST CATEGORY</span>
														</button>
													</div>
												) : (
													<div className='grid grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3'>
														{categories.map((cat) => (
															<div
																key={cat.id}
																className={`group relative aspect-square rounded-xl border transition-all ${cat.is_hidden ? 'opacity-50 border-gray-200' : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'}`}
															>
																{/* Main clickable area */}
																<button
																	onClick={() => { if (!manageCategories) setActiveCategoryId(cat.id ?? null); }}
																	className={`absolute inset-0 flex flex-col items-center justify-center gap-1.5 sm:gap-2 p-2 sm:p-3 rounded-xl w-full h-full ${manageCategories ? 'cursor-default pb-12' : ''}`}
																>
																	<span
																		className='w-5 sm:w-6 h-1.5 rounded-full shrink-0'
																		style={{ backgroundColor: cat.color }}
																	/>
																	<span className={`text-3 sm:text-3.5 font-semibold text-center leading-tight line-clamp-3 ${cat.is_hidden ? 'text-secondary/40' : 'text-secondary'}`}>
																		{cat.name}
																	</span>
																</button>
																{/* Manage actions — large touch targets as a bottom action bar */}
																{canAccessPOS && (
																	<div className={`absolute bottom-0 left-0 right-0 flex rounded-b-xl overflow-hidden border-t border-gray-200 bg-white/95 backdrop-blur-sm transition-opacity ${manageCategories ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
																		<button
																			onClick={(e) => { e.stopPropagation(); toggleCategoryVisibility(cat); }}
																			className={`flex-1 flex items-center justify-center py-3 transition-colors active:scale-95 ${cat.is_hidden ? 'text-error bg-error/10' : 'text-secondary/60 hover:text-secondary hover:bg-gray-100'}`}
																			title={cat.is_hidden ? 'Hidden — tap to show' : 'Visible — tap to hide'}
																		>
																			{cat.is_hidden ? (
																				<svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
																					<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21' />
																				</svg>
																			) : (
																				<svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
																					<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15 12a3 3 0 11-6 0 3 3 0 016 0z' />
																					<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' />
																				</svg>
																			)}
																		</button>
																		<button
																			onClick={(e) => { e.stopPropagation(); setEditingCategory(cat); setShowCategoryForm(true); }}
																			className='flex-1 flex items-center justify-center py-3 border-l border-gray-200 text-secondary/60 hover:text-accent hover:bg-accent/10 transition-colors active:scale-95'
																			title='Edit'
																		>
																			<EditIcon className='w-5 h-5' />
																		</button>
																		<button
																			onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat); }}
																			className='flex-1 flex items-center justify-center py-3 border-l border-gray-200 text-secondary/60 hover:text-error hover:bg-error/10 transition-colors active:scale-95'
																			title='Delete'
																		>
																			<DeleteIcon className='w-5 h-5' />
																		</button>
																	</div>
																)}
															</div>
														))}
															{/* Uncategorized folder — items with no category */}
															{items.filter(i => !i.category_id).length > 0 && (
																<button
																	onClick={() => setActiveCategoryId(UNCAT)}
																	className='group relative aspect-square rounded-xl border border-dashed border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all flex flex-col items-center justify-center gap-1.5 sm:gap-2 p-2 sm:p-3 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'
																>
																	<span className='w-5 sm:w-6 h-1.5 rounded-full shrink-0 bg-gray-300' />
																	<span className='text-3 sm:text-3.5 font-semibold text-center leading-tight line-clamp-3 text-secondary/70'>Uncategorized</span>
																</button>
															)}
													</div>
												)}
											</div>
										)}

										{/* Level 1: Inside a folder — shown when a category is selected */}
										{activeCategoryId !== null && (
											<div>
												{/* Folder-level toolbar */}
												<div className='flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 gap-2'>
													<div className='flex items-center justify-between'>
														{/* Audit config cog (owner only) — mobile */}
														{isOwner && (
															<button
																onClick={() => setShowAuditConfigModal(true)}
																className={`sm:hidden h-12 w-12 shrink-0 flex items-center justify-center rounded-lg transition-all hover:scale-105 active:scale-95 hover:bg-secondary/10 text-secondary/40 hover:text-secondary ${!canAccessPOS ? 'blur-[1px] pointer-events-none' : ''}`}
																title='Audit Configuration'
															>
																<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
																	<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' />
																	<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15 12a3 3 0 11-6 0 3 3 0 016 0z' />
																</svg>
															</button>
														)}
													</div>
													<div className='flex flex-col sm:flex-row sm:items-center gap-2'>
														{/* Resolve uncarried controls — folder-scoped */}
														{isOwner && resolveMode && selectedForResolve.size > 0 && (
															<>
																<button
																	onClick={() => confirmResolve('carry_over')}
																	disabled={resolving}
																	className={`h-12 px-3 flex items-center rounded-lg shadow-sm transition-all hover:scale-105 active:scale-95 bg-success text-white text-3 font-black ${resolving ? 'opacity-50' : ''}`}
																>
																	CARRY OVER {selectedForResolve.size}
																</button>
																<button
																	onClick={() => confirmResolve('destock')}
																	disabled={resolving}
																	className={`h-12 px-3 flex items-center rounded-lg shadow-sm transition-all hover:scale-105 active:scale-95 bg-error text-white text-3 font-black ${resolving ? 'opacity-50' : ''}`}
																>
																	DESTOCK {selectedForResolve.size}
																</button>
															</>
														)}
														{isOwner && folderUncarriedItems.length > 0 && (
															<button
																onClick={() => { setResolveMode(prev => !prev); setSelectedForResolve(new Set()); }}
																className={`h-12 px-3 flex items-center gap-2 rounded-lg shadow-sm font-black text-3 transition-all hover:scale-105 active:scale-95
																	${!canAccessPOS ? 'blur-[1px] pointer-events-none' : ''}
																	${resolveMode ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'}`}
															>
																<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
																	<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' />
																</svg>
																<span>{resolveMode ? 'DONE' : `RESOLVE ${folderUncarriedItems.length}`}</span>
															</button>
														)}
														{destockMode && selectedForDestock.size > 0 && (
															<button
																onClick={() => setShowDestockConfirm(true)}
																className={`h-12 px-4 flex items-center gap-2 rounded-lg shadow-sm font-black text-3 transition-all hover:scale-105 active:scale-95 bg-error text-white ${!canAccessPOS ? 'blur-[1px] pointer-events-none' : ''}`}
															>
																<svg fill='currentColor' stroke='currentColor' viewBox='0 0 15 15' className='w-4 h-4'>
																	<path d='M0.89502 7.50028H14.3021' stroke='currentColor' strokeWidth='3' strokeLinecap='round' />
																</svg>
																<span>DESTOCKS {selectedForDestock.size}</span>
															</button>
														)}
														<button
															onClick={() => { setDestockMode(prev => !prev); setSelectedForDestock(new Set()); }}
															disabled={auditMode}
															className={`h-12 px-4 flex items-center gap-2 rounded-lg shadow-sm font-black text-3 transition-all hover:scale-105 active:scale-95
																${!canAccessPOS ? 'blur-[1px] pointer-events-none' : ''}
																${auditMode ? 'opacity-40 cursor-not-allowed' : ''}
																${destockMode ? 'bg-error text-white' : 'bg-error/10 text-error hover:bg-error/20'}`}
														>
															<div className='size-4'>
																{destockMode ? (
																	<svg fill='none' stroke='currentColor' viewBox='0 0 24 24' className='w-4 h-4'>
																		<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={3} d='M5 13l4 4L19 7' />
																	</svg>
																) : (
																	<svg fill='none' stroke='currentColor' viewBox='0 0 15 15' className='w-4 h-4'>
																		<path d='M0.89502 7.50028H14.3021' stroke='currentColor' strokeWidth='3' strokeLinecap='round' />
																	</svg>
																)}
															</div>
															<span>{destockMode ? 'DONE' : 'DESTOCK'}</span>
														</button>
														{/* AUDIT button — only when inside the audit category folder */}
														{isOwner && activeCategoryId === auditCategoryId && (
															<button
																onClick={toggleAuditMode}
																disabled={destockMode}
																className={`h-12 px-4 flex items-center gap-2 rounded-lg shadow-sm font-black text-3 transition-all hover:scale-105 active:scale-95
																	${!canAccessPOS ? 'blur-[1px] pointer-events-none' : ''}
																	${destockMode ? 'opacity-40 cursor-not-allowed' : ''}
																	${auditMode ? 'bg-secondary text-white' : 'bg-secondary/10 text-secondary hover:bg-secondary/20'}`}
															>
																<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
																	<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' />
																</svg>
																<span>{auditMode ? 'DONE' : 'AUDIT'}</span>
															</button>
														)}
														{/* Lock All button — only in audit folder while audit mode active */}
														{isOwner && activeCategoryId === auditCategoryId && auditMode && (
															<button
																onClick={handleLockAllAudit}
																disabled={!allAuditInputsReady || lockingAudit}
																className={`h-12 px-4 flex items-center gap-2 rounded-lg shadow-sm font-black text-3 transition-all hover:scale-105 active:scale-95
																	${!allAuditInputsReady || lockingAudit ? 'opacity-40 cursor-not-allowed' : ''}
																	bg-secondary text-white`}
															>
																<svg className='w-3.5 h-3.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
																	<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2.5} d='M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' />
																</svg>
																<span>{lockingAudit ? 'LOCKING…' : 'LOCK ALL'}</span>
															</button>
														)}
														{/* Carry Over All — only in audit folder when all items locked */}
														{isOwner && activeCategoryId === auditCategoryId && allAuditItemsLocked && auditCategoryItems.length > 0 && eodSession?.status !== 'submitted' && (
															<button
																onClick={() => setShowCarryOverAllConfirm(true)}
																className={`h-12 px-4 flex items-center gap-2 rounded-lg shadow-sm font-black text-3 transition-all hover:scale-105 active:scale-95 bg-success text-white ${!canAccessPOS ? 'blur-[1px] pointer-events-none' : ''}`}
															>
																<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
																	<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2.5} d='M5 13l4 4L19 7' />
																</svg>
																<span>CARRY OVER ALL</span>
															</button>
														)}
														{/* ADD ITEM — pre-targets current folder */}
														<button
															onClick={() => setShowItemForm(true)}
															disabled={auditMode}
															className={`h-12 px-4 flex items-center gap-2 rounded-lg shadow-sm font-black text-3 transition-all hover:scale-105 active:scale-95 bg-accent hover:bg-accent/90
																${!canAccessPOS ? 'blur-[1px] pointer-events-none' : ''}
																${auditMode ? 'opacity-40 cursor-not-allowed' : ''}`}
														>
															<div className='size-4 text-primary drop-shadow-lg'>
																<PlusIcon />
															</div>
															<span className='text-primary text-shadow-md'>ADD ITEM</span>
														</button>
														{/* Audit config cog (owner only) — desktop */}
														{isOwner && (
															<button
																onClick={() => setShowAuditConfigModal(true)}
																className={`hidden sm:flex h-12 w-12 shrink-0 items-center justify-center rounded-lg transition-all hover:scale-105 active:scale-95 hover:bg-secondary/10 text-secondary/40 hover:text-secondary ${!canAccessPOS ? 'blur-[1px] pointer-events-none' : ''}`}
																title='Audit Configuration'
															>
																<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
																	<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' />
																	<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15 12a3 3 0 11-6 0 3 3 0 016 0z' />
																</svg>
															</button>
														)}
													</div>
												</div>

												{/* Folder header: back button + breadcrumb on one row */}
												{(() => {
													const isUncat = activeCategoryId === UNCAT;
													const activeCat = categories.find(c => c.id === activeCategoryId);
													const folderName = isUncat ? 'Uncategorized' : (activeCat?.name ?? 'Category');
													const folderColor = isUncat ? '#9CA3AF' : (activeCat?.color?.trim() || '#6B7280');
													return (
														<div className='flex items-center gap-3 mb-4 min-w-0'>
															<button
																onClick={handleBackToGrid}
																aria-label='Back to categories'
																title='Back to categories'
																className='h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-100 hover:text-gray-700 hover:border-gray-400 transition-all hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'
															>
																<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
																	<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15 19l-7-7 7-7' />
																</svg>
															</button>
															<nav aria-label='Breadcrumb' className='flex items-center gap-1.5 min-w-0'>
																<button
																	onClick={handleBackToGrid}
																	className='shrink-0 text-2.5 font-bold uppercase tracking-wide text-secondary/45 hover:text-secondary transition-colors'
																>
																	Inventory
																</button>
																<svg className='w-3 h-3 shrink-0 text-secondary/30' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
																	<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 5l7 7-7 7' />
																</svg>
																<span className='w-1.5 h-1.5 rounded-full shrink-0' style={{ backgroundColor: folderColor }} />
																<span className='text-sm font-bold text-secondary truncate'>{folderName}</span>
															</nav>
														</div>
													);
												})()}

												{/* EOD Audit Panel — only in the audit category folder */}
												{isOwner && canAccessPOS && activeCategoryId === auditCategoryId && (eodLocks.length > 0 || eodSession) && (
													<div className='mb-3 border border-secondary/15 rounded-xl overflow-hidden'>
														<button
															onClick={() => setEodPanelOpen(p => !p)}
															className='w-full flex items-center justify-between px-3 py-2.5 bg-secondary/5 hover:bg-secondary/10 transition-colors'
														>
															<div className='flex items-center gap-2'>
																<svg className='w-3.5 h-3.5 text-secondary/60' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
																	<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' />
																</svg>
																<span className='text-xs font-semibold text-secondary'>End-of-Day Audit</span>
																<span className='text-xs text-secondary/40'>· {todayFormatted}</span>
																{eodLocks.length > 0 && (
																	<span className='text-xs bg-secondary/10 text-secondary px-1.5 py-0.5 rounded-full font-semibold'>
																		{eodLocks.length} locked
																	</span>
																)}
																{eodLocks.filter(l => l.discrepancy !== 0).length > 0 && (
																	<span className='text-xs bg-error/10 text-error px-1.5 py-0.5 rounded-full font-semibold'>
																		{eodLocks.filter(l => l.discrepancy !== 0).length} disc.
																	</span>
																)}
																{eodSession?.status === 'submitted' && (
																	<span className='text-xs bg-success/10 text-success px-1.5 py-0.5 rounded-full font-semibold'>Submitted</span>
																)}
															</div>
															<svg className={`w-3.5 h-3.5 text-secondary/40 transition-transform ${eodPanelOpen ? 'rotate-180' : ''}`} fill='none' stroke='currentColor' viewBox='0 0 24 24'>
																<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M19 9l-7 7-7-7' />
															</svg>
														</button>
														{eodPanelOpen && (
															<div className='px-3 py-2.5 space-y-2'>
																{eodLocks.length === 0 ? (
																	<p className='text-xs text-secondary/40 text-center py-2'>
																		No items locked yet. Click the lock icon on any item to start auditing.
																	</p>
																) : (
																	<>
																		<div className='flex items-center gap-2'>
																			<div className='flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden'>
																				<div
																					className='h-full bg-secondary/60 rounded-full transition-all'
																					style={{ width: `${Math.min(100, (eodLocks.length / Math.max(auditCategoryItems.length, 1)) * 100)}%` }}
																				/>
																			</div>
																			<span className='text-xs text-secondary/50 tabular-nums shrink-0'>
																				{eodLocks.length} / {auditCategoryItems.length}
																			</span>
																		</div>
																		<div className='space-y-1 max-h-40 overflow-y-auto'>
																			{eodLocks.map(lock => (
																				<div key={lock.id} className='flex items-center gap-2 text-xs py-0.5'>
																					<span className='truncate flex-1 text-secondary'>{lock.item_name}</span>
																					<span className='text-secondary/40 shrink-0 tabular-nums'>exp {lock.expected_stock} → {lock.locked_stock}</span>
																					{lock.discrepancy === 0 ? (
																						<svg className='w-3 h-3 text-success shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
																							<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2.5} d='M5 13l4 4L19 7' />
																						</svg>
																					) : (
																						<span className={`shrink-0 font-bold ${lock.resolution ? 'text-secondary/40' : 'text-error'}`}>
																							{lock.discrepancy > 0 ? '+' : ''}{lock.discrepancy}
																						</span>
																					)}
																				</div>
																			))}
																		</div>
																	</>
																)}
																{eodLocks.length > 0 && eodSession?.status !== 'submitted' && (
																	<button
																		onClick={() => setShowSubmitEOD(true)}
																		className='w-full mt-1 py-2 bg-secondary hover:bg-secondary/80 text-primary text-xs font-bold rounded-lg transition-all hover:scale-105 active:scale-95'
																	>
																		Submit End-of-Day & Carry Over →
																	</button>
																)}
															</div>
														)}
													</div>
												)}

												{/* Items List */}
												<div className={`space-y-1 ${!canAccessPOS ? 'blur-[1px] pointer-events-none' : ''}`}>
													{inventorySearchUI}
																	{inventorySearch.trim() ? null : filteredItems.length === 0 ? (
														<div className='text-center py-10 text-secondary/40 text-xs'>
															No items in this category
														</div>
													) : (
														filteredItems.map((item) => {
															const isExpanded = expandedItems.has(item.id);
															return (
																<div key={item.id} className={`bg-primary rounded-lg border overflow-hidden transition-colors ${destockMode ? 'border-error/30' : resolveMode && item.uncarried_stock > 0 ? 'border-amber-400/50' : 'border-gray-100'}`}>
																	<div
																		role='button'
																		tabIndex={0}
																		onClick={() => {
																			if (destockMode) toggleDestockSelection(item.id);
																			else if (resolveMode && item.uncarried_stock > 0) toggleResolveSelection(item.id);
																			else toggleExpandItem(item.id);
																		}}
																		onKeyDown={(e) => {
																			if (e.key === 'Enter' || e.key === ' ') {
																				e.preventDefault();
																				if (destockMode) toggleDestockSelection(item.id);
																				else if (resolveMode && item.uncarried_stock > 0) toggleResolveSelection(item.id);
																				else toggleExpandItem(item.id);
																			}
																		}}
																		className='flex items-center gap-3 px-3 py-2.5 cursor-pointer select-none hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset'
																	>
																		{resolveMode && item.uncarried_stock > 0 && (
																			<button
																				onClick={(e) => { e.stopPropagation(); toggleResolveSelection(item.id); }}
																				className={`shrink-0 w-8 h-8 flex items-center justify-center rounded-full border-2 transition-all hover:scale-110 active:scale-95 ${
																					selectedForResolve.has(item.id)
																						? 'bg-amber-500 border-amber-500 text-white'
																						: 'border-amber-400/40 bg-transparent hover:border-amber-500'
																				}`}
																			>
																				{selectedForResolve.has(item.id) && (
																					<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
																						<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={3} d='M5 13l4 4L19 7' />
																					</svg>
																				)}
																			</button>
																		)}
																		{destockMode && (
																			<button
																				onClick={(e) => { e.stopPropagation(); toggleDestockSelection(item.id); }}
																				className={`shrink-0 w-8 h-8 flex items-center justify-center rounded-full border-2 transition-all hover:scale-110 active:scale-95 ${
																					selectedForDestock.has(item.id)
																						? 'bg-error border-error text-white'
																						: 'border-error/40 bg-transparent hover:border-error'
																				}`}
																			>
																				{selectedForDestock.has(item.id) && (
																					<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 15 15'>
																						<path d='M0.89502 7.50028H14.3021' stroke='currentColor' strokeWidth='3' strokeLinecap='round' />
																					</svg>
																				)}
																			</button>
																		)}
																		<span className='w-2 h-2 rounded-full shrink-0' style={{ backgroundColor: getCategoryColor(categories, item.category_id || '') }} />
																		<div className='w-12 h-12 rounded-lg bg-gray-100 shrink-0 overflow-hidden relative flex items-center justify-center'>
																			{item.img_url ? (
																				<Image src={item.img_url} alt={item.name} width={48} height={48} className='w-full h-full object-cover' />
																			) : (
																				<svg className='w-6 h-6 text-gray-400' fill='currentColor' viewBox='0 0 20 20'>
																					<path fillRule='evenodd' d='M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z' clipRule='evenodd' />
																				</svg>
																			)}
																		</div>
																		<span className='text-sm font-semibold text-secondary truncate flex-1 min-w-0'>{item.name}</span>
																		{item.is_custom ? (
																					<span className='text-xs font-semibold text-bundle shrink-0 tabular-nums px-2 py-0.5 rounded-full bg-bundle/10'>{(item.measurement ?? 0) + (item.unit ? ` ${item.unit}` : '')}</span>
																				) : (
																					<span className='text-sm text-secondary/60 shrink-0 tabular-nums'>{formatCurrency(item.price)}</span>
																				)}
																		{item.uncarried_stock > 0 ? (
																			<span className='shrink-0 px-2.5 py-1 rounded-full text-xs font-bold tabular-nums bg-amber-100 text-amber-700' title={`(${item.uncarried_stock} uncarried) + ${item.stock - item.uncarried_stock} new`}>
																				<span className='line-through opacity-50'>{item.uncarried_stock}</span>+{item.stock - item.uncarried_stock}
																			</span>
																		) : (
																			<span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-bold tabular-nums text-center ${
																				item.stock === 0 ? 'bg-error/10 text-error' : item.stock <= 5 ? 'bg-accent/10 text-accent' : 'bg-secondary/10 text-secondary/60'
																			}`}>{item.stock === 0 ? 'Out' : item.stock <= 5 ? `Low ${item.stock}` : item.stock}</span>
																		)}
																		<button onClick={(e) => { e.stopPropagation(); openEditModal(item); }} className='shrink-0 p-2.5 hover:bg-light-accent rounded-lg transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1'>
																			<EditIcon className='w-5 h-5' />
																		</button>
																		{isOwner && canAccessPOS && requiresEodAudit(item.category_id) && (() => {
																			const lock = eodLocks.find(l => l.item_id === item.id);
																			return (
																				<button
																					onClick={(e) => { e.stopPropagation(); setLockingItem(item); }}
																					title={lock ? 'Locked for End-of-Day' : 'Lock for End-of-Day audit'}
																					className={`shrink-0 p-2.5 rounded-lg transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 ${
																						lock ? 'text-secondary bg-secondary/10 hover:bg-secondary/20' : 'text-secondary/30 hover:bg-gray-100 hover:text-secondary'
																					}`}
																				>
																					<svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
																						{lock ? (
																							<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' />
																						) : (
																							<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z' />
																						)}
																					</svg>
																				</button>
																			);
																		})()}
																		<button onClick={(e) => { e.stopPropagation(); toggleExpandItem(item.id); }} className='shrink-0 p-2 hover:bg-gray-100 rounded-lg transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1'>
																			<svg className={`w-4 h-4 text-secondary/40 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill='none' stroke='currentColor' viewBox='0 0 24 24'>
																				<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M19 9l-7 7-7-7' />
																			</svg>
																		</button>
																	</div>
																	{/* Inline audit input (when audit mode + item is in audit category) */}
																	{auditMode && item.category_id === auditCategoryId && (() => {
																		const existingLock = eodLocks.find(l => l.item_id === item.id);
																		if (existingLock) {
																			return (
																				<div className='flex items-center gap-2 px-3 py-1.5 border-t border-secondary/10 bg-secondary/5'>
																					<svg className='w-3 h-3 text-success shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
																						<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2.5} d='M5 13l4 4L19 7' />
																					</svg>
																					<span className='text-xs text-secondary/50'>Locked · exp {existingLock.expected_stock} → {existingLock.locked_stock}</span>
																				</div>
																			);
																		}
																		const inputVal = auditInputs[item.id] ?? '';
																		const expectedStock = inputVal !== '' ? (parseInt(inputVal) || 0) : null;
																		const discrepancy = expectedStock !== null ? item.stock - expectedStock : null;
																		const hasDiscrepancy = discrepancy !== null && discrepancy !== 0;
																		const resolution = auditResolutions[item.id];
																		return (
																			<div className='px-3 py-2 border-t border-secondary/10 bg-secondary/5 space-y-1.5'>
																				<div className='flex items-center gap-2'>
																					<label className='text-xs text-secondary/60 shrink-0'>Expected:</label>
																					<input
																						type='text'
																						inputMode='numeric'
																						value={inputVal}
																						onChange={(e) => {
																							if (e.target.value === '' || /^[0-9]*$/.test(e.target.value)) {
																								setAuditInputs(prev => ({ ...prev, [item.id]: e.target.value }));
																								setAuditResolutions(prev => ({ ...prev, [item.id]: null }));
																							}
																						}}
																						onFocus={(e) => e.target.select()}
																						className='flex-1 px-2 py-1 text-xs border border-secondary/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent'
																						placeholder='Count'
																					/>
																					{discrepancy !== null && (
																						discrepancy === 0 ? (
																							<svg className='w-4 h-4 text-success shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
																								<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2.5} d='M5 13l4 4L19 7' />
																							</svg>
																						) : (
																							<span className={`text-xs font-bold shrink-0 ${discrepancy > 0 ? 'text-accent' : 'text-error'}`}>
																								{discrepancy > 0 ? '+' : ''}{discrepancy}
																							</span>
																						)
																					)}
																				</div>
																				{hasDiscrepancy && (
																					<div className='flex items-center gap-1.5'>
																						<button
																							onClick={() => setAuditResolutions(prev => ({
																								...prev,
																								[item.id]: { type: 'force_carryover', reason: prev[item.id]?.reason ?? '' },
																							}))}
																							className={`px-2 py-1 rounded text-xs font-medium transition-all ${
																								resolution?.type === 'force_carryover'
																									? 'bg-accent text-primary'
																									: 'bg-accent/10 text-accent hover:bg-accent/20'
																							}`}
																						>
																							Carry Over
																						</button>
																						<button
																							onClick={() => setAuditResolutions(prev => ({
																								...prev,
																								[item.id]: { type: 'force_wastage', reason: '' },
																							}))}
																							className={`px-2 py-1 rounded text-xs font-medium transition-all ${
																								resolution?.type === 'force_wastage'
																									? 'bg-error text-primary'
																									: 'bg-error/10 text-error hover:bg-error/20'
																							}`}
																						>
																							Wastage
																						</button>
																						{resolution?.type === 'force_carryover' && (
																							<input
																								type='text'
																								value={resolution.reason}
																								onChange={(e) => setAuditResolutions(prev => ({
																									...prev,
																									[item.id]: { type: 'force_carryover', reason: e.target.value },
																								}))}
																								className='flex-1 px-2 py-1 text-xs border border-secondary/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent'
																								placeholder='Reason (required)'
																							/>
																						)}
																					</div>
																				)}
																			</div>
																		);
																	})()}
																	{isExpanded && (
																		<div className='px-3 pb-2 pt-2 border-t border-gray-100 ml-15 flex flex-wrap gap-x-4 gap-y-1'>
																			{item.description ? (
																				<p className='text-xs text-secondary/60 w-full'>{item.description}</p>
																			) : (
																				<p className='text-xs text-secondary/30 italic w-full'>No description</p>
																			)}
																			{item.cost && item.cost > 0 && (
																				<span className='text-xs text-secondary/60'>Cost: {formatCurrency(item.cost)}</span>
																			)}
																			{item.cost && item.cost > 0 && (
																				<span className='text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded'>
																					{(((item.price - item.cost) / item.price) * 100).toFixed(0)}% margin
																				</span>
																			)}
																			{item.stock <= 5 && (
																				<span className={`text-xs font-medium ${item.stock === 0 ? 'text-error' : 'text-accent'}`}>
																					{item.stock === 0 ? 'Out of stock' : `Only ${item.stock} left`}
																				</span>
																			)}
																		</div>
																	)}
																</div>
															);
														})
													)}
												</div>
											</div>
										)}
									</>
								)}

								{/* Bundles View */}
								{activeTab === 'bundles' && (
									<BundlesView categoryFilter={activeCategoryId} categories={categories} />
								)}
							</div>
						)}

						{/* Modal Components */}
						<EditItemModal
							isOpen={showEditModal}
							editingItem={editingItem}
							categories={categories}
							items={items}
							onClose={closeEditModal}
							onError={handleError}
							eodLock={editingItem ? (eodLocks.find(l => l.item_id === editingItem.id) ?? null) : null}
							onUnlocked={() => {
								if (editingItem) setEodLocks(prev => prev.filter(l => l.item_id !== editingItem.id));
							}}
						/>

						{lockingItem && (
							<LockItemModal
								isOpen={!!lockingItem}
								item={lockingItem}
								existingLock={eodLocks.find(l => l.item_id === lockingItem.id) ?? null}
								onClose={() => setLockingItem(null)}
								onLocked={(lock) => {
									setEodLocks(prev => [...prev.filter(l => l.item_id !== lock.item_id), lock]);
									if (!eodSession) getEodLocks(currentBranch?.id ?? '', new Date().toISOString().slice(0, 10)).then(({ session }) => setEodSession(session));
									setLockingItem(null);
								}}
								onUnlocked={() => {
									setEodLocks(prev => prev.filter(l => l.item_id !== lockingItem.id));
									setLockingItem(null);
								}}
								onError={handleError}
							/>
						)}

						{showSubmitEOD && eodSession && (
							<SubmitEODModal
								isOpen={showSubmitEOD}
								session={eodSession}
								locks={eodLocks}
								allItems={items}
								onClose={() => setShowSubmitEOD(false)}
								onSubmitted={() => {
									setShowSubmitEOD(false);
									setEodSession(prev => prev ? { ...prev, status: 'submitted' } : prev);
								}}
								onError={handleError}
							/>
						)}

						<AddItemModal
							isOpen={showItemForm}
							categories={categories}
							initialCategoryId={activeCategoryId && activeCategoryId !== UNCAT ? activeCategoryId : undefined}
							onClose={() => setShowItemForm(false)}
							onError={handleError}
						/>

						<AddCategoryModal
							branchId={currentBranch?.id || ''}
							isOpen={showCategoryForm}
							editingCategory={editingCategory ?? undefined}
							onClose={() => { setShowCategoryForm(false); setEditingCategory(null); }}
							onError={handleError}
						/>

						{/* Delete Category Confirmation */}
						{showDeleteConfirm && categoryToDelete && (
							<div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4'>
								<div className='bg-white rounded-lg max-w-md w-full p-6'>
									<div className='w-16 h-16 bg-error/20 rounded-xl mx-auto mb-4 flex items-center justify-center'>
										<svg className='w-8 h-8 text-error' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
											<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1-1H8a1 1 0 00-1 1v3M4 7h16' />
										</svg>
									</div>
									<h3 className='text-lg text-center font-bold text-secondary mb-2'>Delete Category</h3>
									<p className='text-secondary opacity-70 mb-6'>
										Are you sure you want to delete the category{" "}
										<span className='px-2 text-primary rounded-full' style={{ backgroundColor: `${categoryToDelete.color}` }}>
											{categoryToDelete.name}
										</span>
										? This action cannot be undone.
									</p>
									<div className='flex gap-3'>
										<button
											onClick={cancelDeleteCategory}
											className='flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-secondary rounded-xl font-semibold transition-all hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1'>
											Cancel
										</button>
										<button
											onClick={confirmDeleteCategory}
											className='flex-1 py-3 bg-error hover:bg-error/50 text-white rounded-xl font-semibold transition-all hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1'>
											Delete
										</button>
									</div>
								</div>
							</div>
						)}

						{/* Audit Config Modal (owner only) */}
						{showAuditConfigModal && currentBranch && (
							<AuditConfigModal
								isOpen={showAuditConfigModal}
								branchId={currentBranch.id}
								categories={categories}
								currentAuditCategoryId={auditCategoryId}
								onClose={() => setShowAuditConfigModal(false)}
								onSaved={() => { setShowAuditConfigModal(false); refreshBranches(); }}
								onError={handleError}
							/>
						)}

						{/* Publish Menu (owner, commissary branch only) */}
						{isOwner && currentBranch?.type === 'commissary' && user && (
							<PublishMenuModal
								isOpen={showPublishModal}
								onClose={() => setShowPublishModal(false)}
								userId={user.id}
								sourceBranchId={currentBranch.id}
								sourceBranchName={currentBranch.name}
								items={items}
								subBranches={availableBranches
									.filter((b) => b.id !== currentBranch.id)
									.map((b) => ({ id: b.id, name: b.name }))}
							/>
						)}

						{/* Carry Over All Confirmation (owner only) */}
						{showCarryOverAllConfirm && eodSession && (
							<div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4'>
								<div className='bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl'>
									<div className='w-14 h-14 bg-success/10 rounded-xl mx-auto mb-4 flex items-center justify-center'>
										<svg className='w-7 h-7 text-success' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
											<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M5 13l4 4L19 7' />
										</svg>
									</div>
									<h3 className='text-base text-center font-bold text-secondary mb-1'>
										Carry Over All Audited Items?
									</h3>
									<p className='text-xs text-secondary/60 text-center mb-4'>
										{eodLocks.length} audited item{eodLocks.length !== 1 ? 's' : ''} will carry their locked stock to tomorrow.
									</p>
									<div className='max-h-36 overflow-y-auto space-y-1 mb-5'>
										{eodLocks.map(lock => (
											<div key={lock.id} className='flex items-center justify-between px-3 py-1.5 bg-gray-50 rounded-lg'>
												<span className='text-xs font-medium text-secondary truncate'>{lock.item_name}</span>
												<span className='text-xs text-success font-bold ml-2 shrink-0'>→ {lock.locked_stock}</span>
											</div>
										))}
									</div>
									<div className='flex gap-3'>
										<button
											onClick={() => setShowCarryOverAllConfirm(false)}
											className='flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-secondary rounded-xl text-sm font-semibold transition-all hover:scale-105 active:scale-95'
										>
											Cancel
										</button>
										<button
											onClick={async () => {
												if (!currentBranch || !eodSession) return;
												const { error } = await submitEOD(currentBranch.id, user?.id ?? null, eodSession.id, eodLocks);
												if (error) { handleError('Failed to carry over. Please try again.'); return; }
												setShowCarryOverAllConfirm(false);
												setEodSession(prev => prev ? { ...prev, status: 'submitted' } : prev);
											}}
											className='flex-1 py-2.5 bg-success hover:bg-success/80 text-white rounded-xl text-sm font-semibold transition-all hover:scale-105 active:scale-95'
										>
											Carry Over
										</button>
									</div>
								</div>
							</div>
						)}

						{/* Destock Confirmation Modal */}
						{showDestockConfirm && (
							<div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4'>
								<div className='bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl'>
									<div className='w-14 h-14 bg-error/10 rounded-xl mx-auto mb-4 flex items-center justify-center'>
										<svg className='w-7 h-7 text-error' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
											<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' />
										</svg>
									</div>
									<h3 className='text-base text-center font-bold text-secondary mb-1'>
										Zero out stock for {selectedForDestock.size} item{selectedForDestock.size !== 1 ? 's' : ''}?
									</h3>
									<div className='mt-3 mb-5 max-h-36 overflow-y-auto space-y-1'>
										{items.filter(i => selectedForDestock.has(i.id)).map(i => (
											<div key={i.id} className='flex items-center justify-between px-3 py-1.5 bg-gray-50 rounded-lg'>
												<span className='text-xs font-medium text-secondary truncate'>{i.name}</span>
												<span className='text-xs text-error font-bold ml-2 shrink-0'>{i.stock} → 0</span>
											</div>
										))}
									</div>
									<div className='flex gap-3'>
										<button
											onClick={() => setShowDestockConfirm(false)}
											disabled={destocking}
											className='flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-secondary rounded-xl text-sm font-semibold transition-all hover:scale-105 active:scale-95 disabled:opacity-50'
										>
											Cancel
										</button>
										<button
											onClick={confirmDestock}
											disabled={destocking}
											className='flex-1 py-2.5 bg-error hover:bg-error/80 text-white rounded-xl text-sm font-semibold transition-all hover:scale-105 active:scale-95 disabled:opacity-50'
										>
											{destocking ? 'Destocking…' : 'Destock'}
										</button>
									</div>
								</div>
							</div>
						)}
					</>
				)}
			</div>

		</div>
	);
}
