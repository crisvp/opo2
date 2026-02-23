import { z } from "zod";

export const GOVERNMENT_LEVELS = {
  FEDERAL: "federal",
  STATE: "state",
  COUNTY: "county",
  PLACE: "place",
  TRIBAL: "tribal",
} as const;

export type GovernmentLevel = (typeof GOVERNMENT_LEVELS)[keyof typeof GOVERNMENT_LEVELS];

export const locationInputSchema = z
  .object({
    governmentLevel: z.enum(["federal", "state", "county", "place", "tribal"]).nullable(),
    stateUsps: z.string().length(2).nullable(),
    placeGeoid: z.string().nullable(),
    tribeId: z.string().nullable(),
  })
  .refine(
    (data) => {
      if (data.governmentLevel === "federal")
        return !data.stateUsps && !data.placeGeoid && !data.tribeId;
      if (data.governmentLevel === "state")
        return !!data.stateUsps && !data.placeGeoid && !data.tribeId;
      if (data.governmentLevel === "county")
        return !!data.stateUsps && !!data.placeGeoid && !data.tribeId;
      if (data.governmentLevel === "place")
        return !!data.stateUsps && !!data.placeGeoid && !data.tribeId;
      if (data.governmentLevel === "tribal")
        return !data.stateUsps && !data.placeGeoid && !!data.tribeId;
      return true;
    },
    { message: "Location fields inconsistent with government level" },
  );

export type LocationInput = z.infer<typeof locationInputSchema>;

export interface State {
  usps: string;
  name: string;
  isTerritory: boolean;
  documentCount: number;
}

export interface Place {
  geoid: string;
  usps: string;
  name: string;
  lsad: string | null;
  lat: number;
  lon: number;
}

export interface Tribe {
  id: string;
  name: string;
  isAlaskaNative: boolean;
}

export const nearestPlacesRequestSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  limit: z.number().int().min(1).max(50).optional().default(10),
});

export type NearestPlacesRequest = z.infer<typeof nearestPlacesRequestSchema>;

export function formatPlaceDisplayName(place: Place): string {
  if (place.lsad) {
    return `${place.name} (${place.lsad}), ${place.usps}`;
  }
  return `${place.name}, ${place.usps}`;
}
