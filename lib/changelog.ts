/**
 * Changelog entries for the "What's New" modal.
 * Add a new entry at the TOP when you bump the version.
 * Only the latest version is shown to users.
 *
 * Keep language simple — users are bakery workers, not developers.
 * Use "you" and action verbs. Describe what they can DO, not what changed.
 *
 * Icons: use simple SVG path data (24x24 viewBox, stroke-based).
 */

export interface ChangelogFeature {
  title: string;
  description: string;
  steps: string[];
  /** SVG path `d` attribute for the feature icon (24x24 viewBox, stroke) */
  iconPath: string;
  /** Optional illustration component key — maps to ChangelogIllustrations */
  illustration?: string;
}

export interface ChangelogEntry {
  version: string;
  features: ChangelogFeature[];
}

export const changelog: ChangelogEntry[] = [
  {
    version: '5.1.2',
    features: [
      {
        title: 'Whole Price Stays Exact',
        description: 'When you set a whole price for several pieces, that exact amount is used.',
        iconPath: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
        steps: [
          'Open a cart item and switch the price editor to Whole Price',
          'Type the total for all the pieces — for example ₱100 for 3 pieces',
          'The order and receipt now show exactly ₱100, not ₱99.99',
        ],
      },
    ],
  },
  {
    version: '5.1.1',
    features: [
      {
        title: 'Small fixes',
        description: 'A few things polished after 5.1.0.',
        iconPath: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
        steps: [
          'Items priced at ₱0.00 can now be added to an order — no longer blocked at checkout',
          'The price editor now has a Per Piece / Whole Price toggle for bulk pricing',
          'Cancelled requests now show "Declined by commissary" or "Request cancelled" so it\'s clear who cancelled',
          'Receiving a commissary shipment now has a single "Sync from commissary" button instead of adding items one by one',
        ],
      },
    ],
  },
  {
    version: '5.1.0',
    features: [
      {
        title: 'Request Items from Commissary',
        description: 'Branches can now send item requests directly to the commissary.',
        iconPath: 'M12 5v14m0 0l-5-5m5 5l5-5',
        steps: [
          'Go to Distribution and tap "Request from Commissary"',
          'Browse by category, pick the items you need, and set how many',
          'Review your request and submit — the commissary will be notified',
        ],
      },
      {
        title: 'Commissary Can Send Partial Amounts',
        description: 'The commissary can fulfill part of a request and add a note explaining why.',
        iconPath: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
        steps: [
          'When a request comes in, the commissary manager opens the request',
          'Adjust the quantity for any item — e.g. send 5 instead of 10',
          'Add a short note explaining the reason, then confirm',
          'The branch will see the adjusted amounts and the note',
        ],
      },
      {
        title: 'Easier Item Selection',
        description: 'Picking items for a transfer now feels like browsing a menu.',
        iconPath: 'M4 6h16M4 10h16M4 14h16M4 18h16',
        steps: [
          'Tap a category to see only the items inside it',
          'Tap an item to set the quantity on a simple +/− sheet',
          'Your selected items appear as a list below — easy to review and remove',
          'Use the search bar to find any item by name across all categories',
        ],
      },
      {
        title: 'Inventory Folders',
        description: 'Items in the inventory are now grouped inside category folders.',
        iconPath: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
        steps: [
          'Tap a folder to open a category and see its items',
          'Tap the back arrow to go back to all folders',
          'Items load faster since only one category is shown at a time',
        ],
      },
    ],
  },
  {
    version: '5.0.2',
    features: [
      {
        title: 'Small fixes',
        description: 'This update is just a fix — no new features.',
        iconPath: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
        steps: [
          'The "What\'s New" pop-up now shows only once a day',
          'After you close it, it stays closed the rest of the day — even if you reload',
          'It comes back the next day so you never miss an update',
          'You can still tick "Don\'t show again until next update" to hide it until the next version',
        ],
      },
    ],
  },
];

/**
 * Get the latest changelog entry.
 */
export function getLatestChangelog(): ChangelogEntry | null {
  return changelog[0] ?? null;
}
