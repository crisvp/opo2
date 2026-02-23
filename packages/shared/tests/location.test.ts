import { describe, it, expect } from "vitest";
import {
  locationInputSchema,
  formatPlaceDisplayName,
  GOVERNMENT_LEVELS,
  nearestPlacesRequestSchema,
} from "../src/index.js";
import type { Place } from "../src/index.js";

// ---------------------------------------------------------------------------
// locationInputSchema
// ---------------------------------------------------------------------------

describe("locationInputSchema", () => {
  it("accepts null governmentLevel with all nulls", () => {
    const result = locationInputSchema.safeParse({
      governmentLevel: null,
      stateUsps: null,
      placeGeoid: null,
      tribeId: null,
    });
    expect(result.success).toBe(true);
  });

  it("accepts federal with no state, place, or tribe", () => {
    const result = locationInputSchema.safeParse({
      governmentLevel: "federal",
      stateUsps: null,
      placeGeoid: null,
      tribeId: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects federal with stateUsps", () => {
    const result = locationInputSchema.safeParse({
      governmentLevel: "federal",
      stateUsps: "CA",
      placeGeoid: null,
      tribeId: null,
    });
    expect(result.success).toBe(false);
  });

  it("rejects federal with tribeId", () => {
    const result = locationInputSchema.safeParse({
      governmentLevel: "federal",
      stateUsps: null,
      placeGeoid: null,
      tribeId: "tribe-123",
    });
    expect(result.success).toBe(false);
  });

  it("accepts state with stateUsps only", () => {
    const result = locationInputSchema.safeParse({
      governmentLevel: "state",
      stateUsps: "CA",
      placeGeoid: null,
      tribeId: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects state without stateUsps", () => {
    const result = locationInputSchema.safeParse({
      governmentLevel: "state",
      stateUsps: null,
      placeGeoid: null,
      tribeId: null,
    });
    expect(result.success).toBe(false);
  });

  it("rejects state with placeGeoid", () => {
    const result = locationInputSchema.safeParse({
      governmentLevel: "state",
      stateUsps: "CA",
      placeGeoid: "0667000",
      tribeId: null,
    });
    expect(result.success).toBe(false);
  });

  it("accepts place with stateUsps and placeGeoid", () => {
    const result = locationInputSchema.safeParse({
      governmentLevel: "place",
      stateUsps: "CA",
      placeGeoid: "0667000",
      tribeId: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects place without placeGeoid", () => {
    const result = locationInputSchema.safeParse({
      governmentLevel: "place",
      stateUsps: "CA",
      placeGeoid: null,
      tribeId: null,
    });
    expect(result.success).toBe(false);
  });

  it("rejects place without stateUsps", () => {
    const result = locationInputSchema.safeParse({
      governmentLevel: "place",
      stateUsps: null,
      placeGeoid: "0667000",
      tribeId: null,
    });
    expect(result.success).toBe(false);
  });

  it("accepts tribal with tribeId", () => {
    const result = locationInputSchema.safeParse({
      governmentLevel: "tribal",
      stateUsps: null,
      placeGeoid: null,
      tribeId: "tribe-123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects tribal with stateUsps", () => {
    const result = locationInputSchema.safeParse({
      governmentLevel: "tribal",
      stateUsps: "CA",
      placeGeoid: null,
      tribeId: "tribe-123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects tribal without tribeId", () => {
    const result = locationInputSchema.safeParse({
      governmentLevel: "tribal",
      stateUsps: null,
      placeGeoid: null,
      tribeId: null,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid governmentLevel", () => {
    const result = locationInputSchema.safeParse({
      governmentLevel: "county",
      stateUsps: null,
      placeGeoid: null,
      tribeId: null,
    });
    expect(result.success).toBe(false);
  });

  it("rejects stateUsps with wrong length", () => {
    const result = locationInputSchema.safeParse({
      governmentLevel: "state",
      stateUsps: "CAL",
      placeGeoid: null,
      tribeId: null,
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// formatPlaceDisplayName
// ---------------------------------------------------------------------------

describe("formatPlaceDisplayName", () => {
  it("includes lsad in display name when present", () => {
    const place: Place = {
      geoid: "0667000",
      usps: "CA",
      name: "Los Angeles",
      lsad: "city",
      lat: 34.05,
      lon: -118.24,
    };
    const result = formatPlaceDisplayName(place);
    expect(result).toBe("Los Angeles (city), CA");
  });

  it("omits lsad when null", () => {
    const place: Place = {
      geoid: "0667000",
      usps: "CA",
      name: "Los Angeles",
      lsad: null,
      lat: 34.05,
      lon: -118.24,
    };
    const result = formatPlaceDisplayName(place);
    expect(result).toBe("Los Angeles, CA");
  });

  it("includes state usps in display name", () => {
    const place: Place = {
      geoid: "3651000",
      usps: "NY",
      name: "New York",
      lsad: "city",
      lat: 40.71,
      lon: -74.0,
    };
    const result = formatPlaceDisplayName(place);
    expect(result).toContain("NY");
  });

  it("includes place name in display name", () => {
    const place: Place = {
      geoid: "3651000",
      usps: "NY",
      name: "Buffalo",
      lsad: null,
      lat: 42.88,
      lon: -78.87,
    };
    const result = formatPlaceDisplayName(place);
    expect(result).toContain("Buffalo");
  });
});

// ---------------------------------------------------------------------------
// GOVERNMENT_LEVELS
// ---------------------------------------------------------------------------

describe("GOVERNMENT_LEVELS", () => {
  it("has the correct federal value", () => {
    expect(GOVERNMENT_LEVELS.FEDERAL).toBe("federal");
  });

  it("has the correct state value", () => {
    expect(GOVERNMENT_LEVELS.STATE).toBe("state");
  });

  it("has the correct place value", () => {
    expect(GOVERNMENT_LEVELS.PLACE).toBe("place");
  });

  it("has the correct tribal value", () => {
    expect(GOVERNMENT_LEVELS.TRIBAL).toBe("tribal");
  });

  it("has exactly five levels (federal, state, county, place, tribal)", () => {
    expect(Object.keys(GOVERNMENT_LEVELS)).toHaveLength(5);
  });
});

// ---------------------------------------------------------------------------
// nearestPlacesRequestSchema
// ---------------------------------------------------------------------------

describe("nearestPlacesRequestSchema", () => {
  it("accepts valid lat/lon", () => {
    const result = nearestPlacesRequestSchema.safeParse({ lat: 37.77, lon: -122.41 });
    expect(result.success).toBe(true);
  });

  it("rejects lat below -90", () => {
    const result = nearestPlacesRequestSchema.safeParse({ lat: -91, lon: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects lat above 90", () => {
    const result = nearestPlacesRequestSchema.safeParse({ lat: 91, lon: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects lon below -180", () => {
    const result = nearestPlacesRequestSchema.safeParse({ lat: 0, lon: -181 });
    expect(result.success).toBe(false);
  });

  it("rejects lon above 180", () => {
    const result = nearestPlacesRequestSchema.safeParse({ lat: 0, lon: 181 });
    expect(result.success).toBe(false);
  });

  it("defaults limit to 10 when not provided", () => {
    const result = nearestPlacesRequestSchema.safeParse({ lat: 0, lon: 0 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(10);
    }
  });

  it("accepts custom limit within bounds", () => {
    const result = nearestPlacesRequestSchema.safeParse({ lat: 0, lon: 0, limit: 25 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(25);
    }
  });

  it("rejects limit above 50", () => {
    const result = nearestPlacesRequestSchema.safeParse({ lat: 0, lon: 0, limit: 51 });
    expect(result.success).toBe(false);
  });

  it("rejects limit of 0", () => {
    const result = nearestPlacesRequestSchema.safeParse({ lat: 0, lon: 0, limit: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer limit", () => {
    const result = nearestPlacesRequestSchema.safeParse({ lat: 0, lon: 0, limit: 5.5 });
    expect(result.success).toBe(false);
  });

  it("rejects missing lat", () => {
    const result = nearestPlacesRequestSchema.safeParse({ lon: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects missing lon", () => {
    const result = nearestPlacesRequestSchema.safeParse({ lat: 0 });
    expect(result.success).toBe(false);
  });

  it("accepts lat/lon at boundary values", () => {
    const result = nearestPlacesRequestSchema.safeParse({ lat: 90, lon: 180 });
    expect(result.success).toBe(true);
  });

  it("accepts lat/lon at negative boundary values", () => {
    const result = nearestPlacesRequestSchema.safeParse({ lat: -90, lon: -180 });
    expect(result.success).toBe(true);
  });
});
