'use client';

import {
  IllMixMatchCard, IllMixMatchPicker, IllMixMatchCart,
  IllDiscountAllItems, IllDiscountInclude, IllDiscountExclude,
  IllSalesVoidButton, IllSalesVoidReason, IllSalesCannotUndo,
  IllInventoryDestockBtn, IllInventoryDestockMode,
  IllEODPanel, IllEODLockItem, IllEODDiscrepancy, IllEODSubmit,
  IllUncarriedItems, IllResolveUncarried,
  IllAuditConfig, IllAuditMode, IllCarryOverAll,
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
    description: 'Destock removes items from inventory — use it for spoiled, expired, or damaged goods. Tap DESTOCK to enter selection mode, select items, then confirm to zero their stock and log as wastage.',
    illustration: <IllInventoryDestockBtn />,
  },
  {
    title: 'Select Items to Destock',
    description: 'In destock mode the edit buttons disappear — tap any item to select it. Tap "DESTOCKS X" to confirm. Stock is zeroed and logged as wastage.',
    illustration: <IllInventoryDestockMode />,
  },
  {
    title: 'Audit Configuration (Owner)',
    description: 'Tap the cog icon next to the Items title to open Audit Configuration. Pick exactly one category whose items will require a manual stock count at end-of-day. All other categories are left untouched.',
    illustration: <IllAuditConfig />,
  },
  {
    title: 'Audit Mode (Owner)',
    description: 'Tap AUDIT to enter audit mode. Each item in the configured category shows an expected stock input. Enter the physical count — a green checkmark means it matches, a red number shows the discrepancy.',
    illustration: <IllAuditMode />,
  },
  {
    title: 'Resolve Discrepancies (Owner)',
    description: "When the count doesn't match, choose Force Carry Over (requires a written reason) to keep the stock, or Wastage to zero the difference. All items must be resolved before locking.",
    illustration: <IllEODDiscrepancy />,
  },
  {
    title: 'Lock All (Owner)',
    description: "Once every audit item has a count and all discrepancies are resolved, tap LOCK ALL. This locks each item's expected stock into the end-of-day record.",
    illustration: <IllEODPanel />,
  },
  {
    title: 'Carry Over All (Owner)',
    description: "After all audit items are locked, the CARRY OVER ALL button appears. Tap it to submit the day — locked counts become tomorrow's opening stock. Non-audit categories are untouched.",
    illustration: <IllCarryOverAll />,
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
