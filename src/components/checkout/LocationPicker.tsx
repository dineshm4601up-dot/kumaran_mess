"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";

const LeafletMap = dynamic(() => import("./LeafletMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[280px] w-full items-center justify-center rounded-[var(--radius-control)] bg-surface-muted">
      <Spinner />
    </div>
  ),
});

type SearchResult = { label: string; lat: number; lon: number };

export function LocationPicker({
  latitude,
  longitude,
  onChange,
}: {
  latitude: number | null;
  longitude: number | null;
  onChange: (lat: number, lon: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [justUsedGps, setJustUsedGps] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const visibleResults = query.trim().length >= 3 ? results : [];

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 3) {
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch(`/api/geocode/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        setResults(data.results ?? []);
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  function selectResult(result: SearchResult) {
    onChange(result.lat, result.lon);
    setQuery(result.label);
    setResults([]);
    setJustUsedGps(false);
  }

  function handleUseMyLocation() {
    setLocationError(null);

    if (!("geolocation" in navigator)) {
      setLocationError("Your browser doesn't support location access.");
      return;
    }

    // Only requested on this explicit click — never automatically. The
    // browser shows its own native permission prompt here; if the
    // customer denies it, we just show a message and they can still use
    // search or type their address manually below.
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onChange(position.coords.latitude, position.coords.longitude);
        setJustUsedGps(true);
        setIsLocating(false);
      },
      (error) => {
        setLocationError(
          error.code === error.PERMISSION_DENIED
            ? "Location access was denied. You can still search or drop a pin manually."
            : "Couldn't get your location. You can still search or drop a pin manually.",
        );
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search for a landmark or area..."
          aria-label="Search for a location"
          className="w-full rounded-[var(--radius-control)] border border-border bg-surface px-3.5 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-2 focus:outline-offset-1 focus:outline-primary"
        />
        {isSearching && (
          <Spinner className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        )}
        {visibleResults.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full rounded-[var(--radius-control)] border border-border bg-surface shadow-md">
            {visibleResults.map((result, index) => (
              <li key={index}>
                <button
                  type="button"
                  onClick={() => selectResult(result)}
                  className="block w-full px-3.5 py-2 text-left text-sm text-foreground hover:bg-surface-muted"
                >
                  {result.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Button type="button" variant="outline" size="sm" isLoading={isLocating} onClick={handleUseMyLocation}>
        📍 Use my current location
      </Button>
      {locationError && <p className="text-sm text-danger">{locationError}</p>}

      <LeafletMap latitude={latitude} longitude={longitude} onChange={onChange} />

      {latitude !== null && longitude !== null ? (
        <p className="text-sm text-muted-foreground">
          Pinned location: {latitude.toFixed(6)}, {longitude.toFixed(6)}
          {justUsedGps && " — from your current location."} Click or drag the pin on the map to adjust it.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          No location pinned yet. Search above, use your current location, or click the map to drop a pin
          — this is optional if you&apos;d rather just type your address below.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Your current location is only a starting point, not assumed to be your exact delivery address —
        please confirm the pin and the address details below are correct.
      </p>
    </div>
  );
}
