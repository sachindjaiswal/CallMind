import { describe, expect, it } from "vitest";
import {
  categoryLabel,
  groupByInsightCategory,
} from "./insight-categories";

describe("insight categories", () => {
  it("groups known categories in canonical order and omits empty groups", () => {
    const groups = groupByInsightCategory([
      { id: "task-1", category: "task" },
      { id: "person-1", category: "person" },
      { id: "task-2", category: "task" },
    ]);

    expect(groups.map((group) => group.category)).toEqual(["person", "task"]);
    expect(groups.find((group) => group.category === "task")?.items).toHaveLength(2);
    expect(groups.some((group) => group.category === "date")).toBe(false);
  });

  it("humanizes unknown categories without crashing", () => {
    const groups = groupByInsightCategory([
      { id: "known", category: "task" },
      { id: "unknown", category: "custom_signal" },
    ]);

    expect(groups.map((group) => group.category)).toEqual([
      "task",
      "custom_signal",
    ]);
    expect(groups[1]?.label).toBe("Custom Signal");
    expect(categoryLabel("custom_signal")).toBe("Custom Signal");
    expect(categoryLabel("")).toBe("Other insights");
  });
});
