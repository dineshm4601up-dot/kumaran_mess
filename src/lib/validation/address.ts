import "server-only";

export type AddressInput = {
  addressLine: string;
  landmark: string | null;
  latitude: number | null;
  longitude: number | null;
  deliveryInstructions: string | null;
};

export function parseAddressBody(body: Record<string, unknown> | null): {
  errors: string[];
  values: AddressInput;
} {
  const addressLine = typeof body?.addressLine === "string" ? body.addressLine.trim() : "";
  const landmark =
    typeof body?.landmark === "string" && body.landmark.trim() ? body.landmark.trim() : null;
  const deliveryInstructions =
    typeof body?.deliveryInstructions === "string" && body.deliveryInstructions.trim()
      ? body.deliveryInstructions.trim()
      : null;

  const rawLat = body?.latitude;
  const rawLon = body?.longitude;
  const latitude = typeof rawLat === "number" && Number.isFinite(rawLat) ? rawLat : null;
  const longitude = typeof rawLon === "number" && Number.isFinite(rawLon) ? rawLon : null;

  const errors: string[] = [];
  if (!addressLine) errors.push("address_required");
  if (latitude !== null && (latitude < -90 || latitude > 90)) errors.push("invalid_latitude");
  if (longitude !== null && (longitude < -180 || longitude > 180)) errors.push("invalid_longitude");
  if ((latitude === null) !== (longitude === null)) errors.push("incomplete_coordinates");

  return { errors, values: { addressLine, landmark, latitude, longitude, deliveryInstructions } };
}
