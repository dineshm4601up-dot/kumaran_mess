"use client";

import dynamic from "next/dynamic";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";

const LeafletMap = dynamic(() => import("@/components/checkout/LeafletMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[220px] w-full items-center justify-center rounded-[var(--radius-control)] bg-surface-muted">
      <Spinner />
    </div>
  ),
});

export function OrderLocationMap({ latitude, longitude }: { latitude: number | null; longitude: number | null }) {
  if (latitude === null || longitude === null) {
    return <p className="text-sm text-muted-foreground">No location was pinned for this order.</p>;
  }

  // The directions URL takes raw coordinates as the destination, not an
  // address lookup — unambiguous, and opens the customer's actual pinned
  // point whether or not Google has a matching address for it.
  const navigationUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;

  return (
    <div className="flex flex-col gap-3">
      <LeafletMap latitude={latitude} longitude={longitude} readOnly />
      <p className="text-xs text-muted-foreground">
        Pinned: {latitude.toFixed(6)}, {longitude.toFixed(6)}
      </p>
      <a href={navigationUrl} target="_blank" rel="noopener noreferrer">
        <Button type="button" variant="outline" size="sm">
          Open in navigation app
        </Button>
      </a>
    </div>
  );
}
