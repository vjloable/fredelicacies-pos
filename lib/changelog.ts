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
    version: '4.11.0',
    features: [
      {
        title: 'Owner Dashboard',
        description: 'See how all your branches are doing at a glance.',
        iconPath: 'M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zm-10 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10-2a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1h-4a1 1 0 01-1-1v-6z',
        illustration: 'dashboard',
        steps: [
          'Owners now land on the Dashboard after login',
          'See total revenue, orders, and active branches today',
          'Compare branch performance side by side',
          'Alerts show branches that need attention',
        ],
      },
      {
        title: 'Cash Monitoring',
        description: 'Track your register cash from open to close.',
        iconPath: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z',
        illustration: 'cash-monitoring',
        steps: [
          'Manager taps "Open Shift" in the top bar',
          'Enter the starting cash in the register',
          'Workers take orders throughout the day',
          'Manager taps "Close Shift" and counts the actual cash',
          'A report shows if cash is correct, over, or short',
        ],
      },
      {
        title: 'Auto Clock-Out',
        description: 'Everyone gets clocked out when the shift closes.',
        iconPath: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
        illustration: 'auto-clockout',
        steps: [
          'When a manager closes the shift, all workers at that branch are automatically clocked out',
          'No more forgotten clock-outs overnight',
          'Attendance records are accurate without manual work',
        ],
      },
      {
        title: 'Safe Drop',
        description: 'Move cash from the register to the safe and keep a record.',
        iconPath: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
        illustration: 'safe-drop',
        steps: [
          'Open the order panel in the store page',
          'Tap "Safe Drop"',
          'Enter the amount and select who received it',
          'The drop is recorded and subtracted from expected cash',
        ],
      },
      {
        title: 'Write Off',
        description: 'Record free items or near-expiry products.',
        iconPath: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
        illustration: 'write-off',
        steps: [
          'Open the order panel in the store page',
          'Tap "Write Off"',
          'Choose "Free Item" or "Near Expiry"',
          'Search and select the item, set the quantity',
          'The stock is automatically reduced',
        ],
      },
      {
        title: 'Reset Branch Data',
        description: 'Clear sales, inventory, or all data for a branch.',
        iconPath: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
        illustration: 'reset-branch',
        steps: [
          'Go to Branches, edit a branch, scroll to "Danger Zone"',
          'Choose what to reset: Sales, Inventory, or Everything',
          'Type the branch name to confirm',
          'Data is permanently deleted — workers and branch settings stay',
        ],
      },
      {
        title: 'Cleaner Navigation',
        description: 'Less clutter in the sidebar.',
        iconPath: 'M4 6h16M4 12h16M4 18h16',
        illustration: 'cleaner-nav',
        steps: [
          'Distribution and Settings now show only once based on your role',
          'Owners land on Dashboard instead of Branches',
          'Profile button is now visually clickable',
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
