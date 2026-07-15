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
