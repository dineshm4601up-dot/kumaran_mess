"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";

// Leaflet's default marker icon references relative image paths that
// don't survive bundling under Next.js/Turbopack — pointing at the same
// version's files on a CDN avoids needing to copy binary assets into
// public/ ourselves.
const markerIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const DEFAULT_CENTER: [number, number] = [20.5937, 78.9629]; // India, roughly centered
const DEFAULT_ZOOM = 5;
const PINNED_ZOOM = 16;

function RecenterOnChange({ lat, lon }: { lat: number | null; lon: number | null }) {
  const map = useMap();
  useEffect(() => {
    if (lat !== null && lon !== null) {
      map.setView([lat, lon], Math.max(map.getZoom(), PINNED_ZOOM));
    }
  }, [lat, lon, map]);
  return null;
}

function ClickToSetMarker({ onChange }: { onChange: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(event) {
      onChange(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

export default function LeafletMap({
  latitude,
  longitude,
  onChange,
  readOnly = false,
}: {
  latitude: number | null;
  longitude: number | null;
  onChange?: (lat: number, lon: number) => void;
  readOnly?: boolean;
}) {
  const hasPin = latitude !== null && longitude !== null;
  const center: [number, number] = hasPin ? [latitude, longitude] : DEFAULT_CENTER;

  return (
    <MapContainer
      center={center}
      zoom={hasPin ? PINNED_ZOOM : DEFAULT_ZOOM}
      style={{ height: "280px", width: "100%" }}
      className="rounded-[var(--radius-control)]"
      dragging={!readOnly || hasPin}
      scrollWheelZoom={!readOnly}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {!readOnly && onChange && <ClickToSetMarker onChange={onChange} />}
      <RecenterOnChange lat={latitude} lon={longitude} />
      {hasPin && (
        <Marker
          position={[latitude, longitude]}
          icon={markerIcon}
          draggable={!readOnly}
          eventHandlers={
            !readOnly && onChange
              ? {
                  dragend(event) {
                    const marker = event.target as L.Marker;
                    const position = marker.getLatLng();
                    onChange(position.lat, position.lng);
                  },
                }
              : undefined
          }
        />
      )}
    </MapContainer>
  );
}
