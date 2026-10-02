export const CATEGORIES = [
  "Buttons",
  "Cards",
  "Forms",
  "Navigation",
  "Hero",
  "Badges",
  "Pricing",
  "Loaders",
] as const;

export type Category = (typeof CATEGORIES)[number];
