export interface ChangelogEntry {
  version: string;
  date: string;
  updates: string[];
}

const changelogEntriesNewestFirst: ChangelogEntry[] = [
  {
    version: "v1",
    date: "August 2026",
    updates: [
      "View each seller account’s payment method and recent payout destinations on Accounts.",
      "Use AI-suggested inbox rules to organize recurring messages and preview matches before applying them.",
      "Applied inbox rules are saved to your account and restored when you return.",
      "Inbox analysis now reviews up to 100 messages, cleans HTML email content, and clearly notes when long messages are truncated.",
      "Select multiple inbox messages to move them to Trash, or permanently delete multiple trashed messages at once.",
      "Launched Tracking page: 30/90-day shipping fulfillment view, refunded-order filter, richer shipment cards.",
      "Tracking now uses compact expandable order cards and clearer stage and seller layouts on phones and narrow screens.",
      "See fulfilled and awaiting items separately within partially fulfilled orders, and filter items that need attention.",
      "Theme selector now shows the active saved theme after refreshing.",
      "Filter inbox messages by seller.",
      "API usage now separates notifications, settings, tracking, and AI inbox analysis instead of grouping them as Other.",
    ],
  },
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
      "Switch between themes.",
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
    date: "May 10 2025",
    updates: [
      "Added interactive charts for payouts and listing value over time.",
    ],
  },
  {
    version: "pre-release",
    date: "March-May 2025",
    updates: [
      "Launched the first version of Sealift for listings, payouts, transactions, and inventory.",
      "Supported multiple users and improved browsing speed.",
    ],
  },
];

export const changelogEntries = [...changelogEntriesNewestFirst].reverse();
