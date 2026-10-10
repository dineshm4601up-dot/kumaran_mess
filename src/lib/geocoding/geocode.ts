import "server-only";

export type GeocodeResult = {
  label: string;
  lat: number;
  lon: number;
};

// Provider-agnostic, same pattern as src/lib/sms/send-sms.ts: the UI never
// knows which provider answered, so switching later is a one-file change.
//
// This must run server-side regardless of provider: browsers refuse to
// let JS override the User-Agent header, and Nominatim's usage policy
// (https://operations.osmfoundation.org/policies/nominatim/) requires a
// descriptive one identifying the application, plus a hard cap of 1
// request/second and no heavy/automated use — only enforceable from a
// server we control, not a direct browser call. LocationIQ needs its API
// key kept server-side regardless.
export async function searchAddress(query: string): Promise<GeocodeResult[]> {
  const provider = process.env.GEOCODING_PROVIDER ?? "nominatim";

  if (!query.trim()) return [];

  switch (provider) {
    case "locationiq":
      return searchViaLocationIq(query);
    case "nominatim":
    default:
      return searchViaNominatim(query);
  }
}

// Public Nominatim instance (nominatim.openstreetmap.org) — free, but
// explicitly NOT for production/high-volume use per its usage policy:
// max 1 request/second, no heavy use, results must carry "© OpenStreetMap
// contributors" attribution (see LocationPicker.tsx), and it can rate-limit
// or block a User-Agent that doesn't identify a real application. This is
// the dev-safe default; switch GEOCODING_PROVIDER=locationiq for anything
// beyond local development/testing.
async function searchViaNominatim(query: string): Promise<GeocodeResult[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "5");
  url.searchParams.set("countrycodes", "in");

  const response = await fetch(url, {
    headers: {
      "User-Agent": "KumaranMess/1.0 (dev; contact via project owner)",
    },
  });

  if (!response.ok) {
    console.error("searchViaNominatim: request failed", response.status);
    return [];
  }

  const data: Array<{ display_name: string; lat: string; lon: string }> = await response.json();
  return data.map((item) => ({
    label: item.display_name,
    lat: parseFloat(item.lat),
    lon: parseFloat(item.lon),
  }));
}

// LocationIQ (locationiq.com): OSM-data-based, generous free tier as of
// this writing (check their current pricing page — it changes), simpler
// usage limits than self-managing Nominatim's policy, and the one we'd
// actually want for anything beyond local dev. Needs LOCATIONIQ_API_KEY.
async function searchViaLocationIq(query: string): Promise<GeocodeResult[]> {
  const apiKey = process.env.LOCATIONIQ_API_KEY;
  if (!apiKey) {
    console.error("searchViaLocationIq: LOCATIONIQ_API_KEY is not set");
    return [];
  }

  const url = new URL("https://us1.locationiq.com/v1/search");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "5");
  url.searchParams.set("countrycodes", "in");

  const response = await fetch(url);
  if (!response.ok) {
    console.error("searchViaLocationIq: request failed", response.status);
    return [];
  }

  const data: Array<{ display_name: string; lat: string; lon: string }> = await response.json();
  return data.map((item) => ({
    label: item.display_name,
    lat: parseFloat(item.lat),
    lon: parseFloat(item.lon),
  }));
}
