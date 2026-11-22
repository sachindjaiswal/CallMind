import { INSIGHT_CATEGORIES, type InsightCategory } from "@callmind/shared";
import {
  AlertTriangle,
  ArrowLeftRight,
  CalendarDays,
  Folder,
  Gavel,
  Handshake,
  HelpCircle,
  ListChecks,
  Sparkles,
  Tag,
  Users,
  type LucideIcon,
} from "lucide-react";

export const CATEGORY_LABELS: Record<InsightCategory, string> = {
  topic: "Topics",
  person: "People",
  task: "Tasks",
  date: "Dates",
  decision: "Decisions",
  commitment: "Commitments",
  transaction: "Transactions",
  project: "Projects",
  risk: "Risks",
  question: "Questions",
  insight: "Insights",
};

export const CATEGORY_ICONS: Record<InsightCategory, LucideIcon> = {
  topic: Tag,
  person: Users,
  task: ListChecks,
  date: CalendarDays,
  decision: Gavel,
  commitment: Handshake,
  transaction: ArrowLeftRight,
  project: Folder,
  risk: AlertTriangle,
  question: HelpCircle,
  insight: Sparkles,
};

export interface InsightCategoryGroup<T> {
  category: string;
  label: string;
  icon: LucideIcon;
  items: T[];
}

function humanizeCategory(category: string): string {
  const words = category
    .trim()
    .replace(/[_-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return "Other insights";
  }

  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category as InsightCategory] ?? humanizeCategory(category);
}

export function categoryIcon(category: string): LucideIcon {
  return CATEGORY_ICONS[category as InsightCategory] ?? Sparkles;
}

export function groupByInsightCategory<T extends { category: string }>(
  items: T[],
): InsightCategoryGroup<T>[] {
  const groups: InsightCategoryGroup<T>[] = [];
  const known = new Set<string>(INSIGHT_CATEGORIES);

  for (const category of INSIGHT_CATEGORIES) {
    const categoryItems = items.filter((item) => item.category === category);
    if (categoryItems.length === 0) {
      continue;
    }
    groups.push({
      category,
      label: CATEGORY_LABELS[category],
      icon: CATEGORY_ICONS[category],
      items: categoryItems,
    });
  }

  const unknownGroups = new Map<string, T[]>();
  for (const item of items) {
    if (known.has(item.category)) {
      continue;
    }
    const key = item.category.trim() || "other";
    const current = unknownGroups.get(key) ?? [];
    current.push(item);
    unknownGroups.set(key, current);
  }

  for (const [category, categoryItems] of unknownGroups) {
    groups.push({
      category,
      label: categoryLabel(category),
      icon: categoryIcon(category),
      items: categoryItems,
    });
  }

  return groups;
}
