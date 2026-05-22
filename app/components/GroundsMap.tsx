"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icon paths for webpack/Next.js bundling
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png"
});

export interface GroundMarker {
  id: number;
  name: string;
  lat: number;
  lng: number;
}

interface GroundsMapProps {
  grounds: GroundMarker[];
  highlightedId: number | null;
}

export function GroundsMapInner({ grounds, highlightedId }: GroundsMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<number, L.Marker>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const map = L.map(containerRef.current, {
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      touchZoom: false,
      zoomControl: false,
      attributionControl: true
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 18
    }).addTo(map);

    mapRef.current = map;
    const markers = markersRef.current;

    return () => {
      map.remove();
      mapRef.current = null;
      markers.forEach((marker) => marker.remove());
      markers.clear();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current.clear();

    const validGrounds = grounds.filter((g) => g.lat !== 0 && g.lng !== 0);

    if (validGrounds.length === 0) return;

    const bounds = L.latLngBounds(validGrounds.map((g) => [g.lat, g.lng]));

    validGrounds.forEach((ground) => {
      const marker = L.marker([ground.lat, ground.lng]).addTo(map);
      const popup = L.DomUtil.create("div");
      const strong = L.DomUtil.create("strong", "", popup);
      strong.textContent = ground.name;
      marker.bindPopup(popup);
      markersRef.current.set(ground.id, marker);
    });

    map.fitBounds(bounds, { padding: [30, 30] });
  }, [grounds]);

  useEffect(() => {
    if (highlightedId == null) return;

    const marker = markersRef.current.get(highlightedId);
    if (marker) {
      marker.openPopup();
    }
  }, [highlightedId]);

  return <div ref={containerRef} className="grounds-map-inner" />;
}
