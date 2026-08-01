export interface ChangelogEntry {
  version: string;
  date: string;
  updates: string[];
}

const changelogEntriesNewestFirst: ChangelogEntry[] = [
  {
    version: "v1",
    date: "July 2026",
    updates: [
      "Reset passwords and manage account details more easily.",
      "See and subscribe to the thematic topics.",
      "Alerts now connect to your Sealift email automatically.",
      "AI responses feel more responsive with live streaming.",
    ],
  },
  {
    version: "v1",
    date: "April 2026",
    updates: [
      "Manage multiple stores from one account.",
      "Secure authentication improvements.",
      "Use an AI assistant and sandbox mode with less setup.",
    ],
  },
  {
    version: "beta",
    date: "February 2026",
    updates: [
      "Switch between light and dark themes.",
      "Track API usage without digging through settings.",
      "Get notifications faster with live updates.",
    ],
  },
  {
    version: "beta",
    date: "August 12 2025",
    updates: ["Remove user accounts when needed."],
  },
  {
    version: "pre-release",
    date: "May 31 2025",
    updates: [
      "Released more reliable Docker images and clearer error handling.",
    ],
  },
  {
    version: "pre-release",
    date: "May 10 2025",
    updates: [
      "Added interactive charts for payouts and listing value over time.",
    ],
  },
  {
    version: "pre-release",
    date: "March-May 2025",
    updates: [
      "Launched the first version of Sealift for listings, payouts, transactions, and gallery.",
      "Supported multiple users and improved browsing speed.",
    ],
  },
];

export const changelogEntries = [...changelogEntriesNewestFirst].reverse();
