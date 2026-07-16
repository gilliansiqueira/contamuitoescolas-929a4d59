import { describe, it, expect } from "vitest";
import { parseSpreadsheetDate } from "@/lib/dateUtils";

describe("example", () => {
  it("should pass", () => {
    expect(true).toBe(true);
  });
});

describe("parseSpreadsheetDate", () => {
  it("keeps Brazilian dates and Excel serials on the same calendar day", () => {
    expect(parseSpreadsheetDate("01/06/2026")).toBe("2026-06-01");
    expect(parseSpreadsheetDate("01-06-2026")).toBe("2026-06-01");
    expect(parseSpreadsheetDate(46174)).toBe("2026-06-01");
    expect(parseSpreadsheetDate(46173.875)).toBe("2026-06-01");
    expect(parseSpreadsheetDate(new Date(Date.UTC(2026, 5, 1)))).toBe("2026-06-01");
  });
});
