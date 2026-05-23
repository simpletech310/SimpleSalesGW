import { describe, expect, it } from "vitest";
import { buildCsv, csvCell, csvDate, csvRow } from "@/lib/csv";

describe("csvCell", () => {
  it("returns empty string for null and undefined", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });

  it("passes simple values through unchanged", () => {
    expect(csvCell("hello")).toBe("hello");
    expect(csvCell(42)).toBe("42");
    expect(csvCell(true)).toBe("true");
  });

  it("quotes values containing commas", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
  });

  it("quotes and escapes embedded double quotes", () => {
    expect(csvCell('she said "hi"')).toBe('"she said ""hi"""');
  });

  it("quotes values containing newlines", () => {
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
    expect(csvCell("line1\r\nline2")).toBe('"line1\r\nline2"');
  });

  it("quotes values with leading/trailing whitespace", () => {
    expect(csvCell(" leading")).toBe('" leading"');
    expect(csvCell("trailing ")).toBe('"trailing "');
  });
});

describe("csvRow + buildCsv", () => {
  it("joins cells with comma", () => {
    expect(csvRow(["a", "b", "c"])).toBe("a,b,c");
  });

  it("buildCsv joins rows with CRLF", () => {
    expect(buildCsv([["a", "b"], ["c", "d"]])).toBe("a,b\r\nc,d");
  });

  it("handles all quote cases in a header+row roundtrip", () => {
    const csv = buildCsv([
      ["name", "note"],
      ["Lin", 'said "ship it"'],
      ["Marcelo", "ok,today"],
    ]);
    expect(csv).toBe('name,note\r\nLin,"said ""ship it"""\r\nMarcelo,"ok,today"');
  });
});

describe("csvDate", () => {
  it("returns empty for null/undefined", () => {
    expect(csvDate(null)).toBe("");
    expect(csvDate(undefined)).toBe("");
  });

  it("formats Date as ISO 8601", () => {
    const d = new Date("2026-05-23T12:00:00.000Z");
    expect(csvDate(d)).toBe("2026-05-23T12:00:00.000Z");
  });
});
