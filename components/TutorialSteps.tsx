'use client';

import {
  IllMixMatchCard, IllMixMatchPicker, IllMixMatchCart,
  IllDiscountAllItems, IllDiscountInclude, IllDiscountExclude,
  IllSalesVoidButton, IllSalesVoidReason, IllSalesCannotUndo,
  IllInventoryDestockBtn, IllInventoryDestockMode,
  IllEODPanel, IllEODLockItem, IllEODDiscrepancy, IllEODSubmit,
  IllUncarriedItems, IllResolveUncarried,
} from './TutorialIllustrations';
import type { TutorialStep } from './TutorialModal';

export const storeSteps: TutorialStep[] = [
  {
    title: 'Mix & Match Bundle',
    description: "This bundle lets the customer choose their own items. Tapping it opens a picker where you select components up to the bundle's maximum piece count.",
    illustration: <IllMixMatchCard />,
  },
  {
    title: 'Building the Order',
    description: 'Select items from the picker until you hit the max. Each selection deducts from available stock. Tap Confirm to add the bundle to the cart.',
    illustration: <IllMixMatchPicker />,
  },
  {
    title: 'In the Cart',
    description: "Custom bundles appear as a single line item. You can't adjust the quantity — to add another, tap the bundle again and build a new one.",
    illustration: <IllMixMatchCart />,
  },
];

export const discountsSteps: TutorialStep[] = [
  {
    title: 'All Items',
    description: 'By default the discount applies to everything in the cart. Leave this set to "All Items" if no restriction is needed.',
    illustration: <IllDiscountAllItems />,
  },
  {
    title: 'Include Specific Categories',
    description: 'Choose "Include" and select categories. The discount will only apply to items belonging to those categories — everything else is excluded.',
    illustration: <IllDiscountInclude />,
  },
  {
    title: 'Exclude Specific Categories',
    description: 'Choose "Exclude" and select categories. The discount applies to everything EXCEPT items in those categories — useful for exempting premium or promo items.',
    illustration: <IllDiscountExclude />,
  },
];

export const salesSteps: TutorialStep[] = [
  {
    title: 'Voiding an Order',
    description: 'Marking an order as void removes it from revenue totals and reports. The order stays visible in the log with a VOIDED status for audit purposes.',
    illustration: <IllSalesVoidButton />,
  },
  {
    title: 'Adding a Reason',
    description: 'The reason field is optional but recommended. It is saved to the activity log and helps explain the void when reviewing records later.',
    illustration: <IllSalesVoidReason />,
  },
  {
    title: 'Cannot Be Undone',
    description: 'Once confirmed, the void cannot be reversed. Double-check the order number before confirming.',
    illustration: <IllSalesCannotUndo />,
  },
];

export const inventorySteps: TutorialStep[] = [
  {
    title: 'Destock',
    description: 'Destock removes items from inventory — use it for spoiled, expired, or damaged goods. Categories set to "Destock Only" by the owner can only be destocked, not carried over.',
    illustration: <IllInventoryDestockBtn />,
  },
  {
    title: 'Select Items to Destock',
    description: 'Tap DESTOCK to enter selection mode. The edit buttons disappear — tap any item to select it. Tap "DESTOCKS X" to confirm. Stock is zeroed and logged as wastage.',
    illustration: <IllInventoryDestockMode />,
  },
  {
    title: 'End-of-Day Audit',
    description: "At the end of each shift, use the audit panel to record the actual stock count. Only items in categories set to \"Carryover\" by the owner can be locked — other categories auto-carry over.",
    illustration: <IllEODPanel />,
  },
  {
    title: 'Lock an Item',
    description: 'Tap the lock icon on any item row. Enter the expected End-of-Day stock — the system calculates the discrepancy against the actual count.',
    illustration: <IllEODLockItem />,
  },
  {
    title: 'Resolve Discrepancies',
    description: 'If the count differs, choose: re-count (unlock), force carry-over with a written reason, or log the difference as wastage.',
    illustration: <IllEODDiscrepancy />,
  },
  {
    title: 'Submit & Carry Over',
    description: 'Once all items are locked, tap "Submit End-of-Day". Locked counts become the opening stock. Unlocked carryover items are flagged as uncarried.',
    illustration: <IllEODSubmit />,
  },
  {
    title: 'Uncarried Items',
    description: 'Items not locked during EOD show their stock as "(X uncarried) + Y new". The uncarried portion is frozen and cannot be sold until resolved.',
    illustration: <IllUncarriedItems />,
  },
  {
    title: 'Resolve Uncarried',
    description: 'Tap "RESOLVE" to enter selection mode. Select uncarried items, then choose "CARRY OVER" to accept the stock, or "DESTOCK" to zero it out as wastage.',
    illustration: <IllResolveUncarried />,
  },
];
