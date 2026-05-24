import { describe, expect, it } from "vitest";
import { pointInPolygon, extractPolygonRing } from "@/lib/geo/mapbox";

/**
 * v2.22 — unit tests for the polygon math underlying territory matching.
 *
 * Note: matchTerritoryForLead() itself hits Prisma so the integration
 * shape is exercised in the live smoke test, not in vitest. These tests
 * lock in the pure point-in-polygon helper + the GeoJSON parse helper.
 */

describe("pointInPolygon", () => {
  // Simple square: lng 0-10, lat 0-10 (counter-clockwise)
  const square: Array<[number, number]> = [
    [0, 0], [10, 0], [10, 10], [0, 10], [0, 0],
  ];

  it("returns true for a point inside the square", () => {
    expect(pointInPolygon({ lng: 5, lat: 5 }, square)).toBe(true);
  });

  it("returns false for a point outside the square", () => {
    expect(pointInPolygon({ lng: 20, lat: 5 }, square)).toBe(false);
    expect(pointInPolygon({ lng: -1, lat: 5 }, square)).toBe(false);
    expect(pointInPolygon({ lng: 5, lat: 20 }, square)).toBe(false);
  });

  it("returns false for a degenerate polygon (< 3 points)", () => {
    expect(pointInPolygon({ lng: 5, lat: 5 }, [[0, 0], [10, 10]])).toBe(false);
  });

  it("handles a real-world SoCal polygon", () => {
    // Rough rectangle around Los Angeles County (approximate)
    const la: Array<[number, number]> = [
      [-118.7, 33.7],
      [-117.6, 33.7],
      [-117.6, 34.5],
      [-118.7, 34.5],
      [-118.7, 33.7],
    ];
    // Burbank: ~ -118.33, 34.18 → should be inside
    expect(pointInPolygon({ lng: -118.33, lat: 34.18 }, la)).toBe(true);
    // San Francisco: ~ -122.4, 37.8 → should be outside
    expect(pointInPolygon({ lng: -122.4, lat: 37.8 }, la)).toBe(false);
  });
});

describe("extractPolygonRing", () => {
  it("extracts the outer ring from a valid GeoJSON Polygon", () => {
    const polygon = {
      type: "Polygon",
      coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]],
    };
    const ring = extractPolygonRing(polygon);
    expect(ring).toEqual([[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]);
  });

  it("returns null for non-polygon shapes", () => {
    expect(extractPolygonRing({ type: "Point", coordinates: [0, 0] })).toBeNull();
    expect(extractPolygonRing(null)).toBeNull();
    expect(extractPolygonRing(undefined)).toBeNull();
    expect(extractPolygonRing("not a polygon")).toBeNull();
  });

  it("returns null for malformed coordinates", () => {
    expect(extractPolygonRing({ type: "Polygon", coordinates: [] })).toBeNull();
    expect(extractPolygonRing({ type: "Polygon", coordinates: [[[0]]] })).toBeNull();
    expect(extractPolygonRing({ type: "Polygon", coordinates: [[["a", "b"]]] })).toBeNull();
  });
});
