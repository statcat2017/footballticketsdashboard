"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { adminVenuePinIcon } from "../../../venues/_components/leafletPinIcon";

export interface DivisionGroundMarker {
  clubId: number;
  clubName: string;
  venueName: string;
  postcode: string | null;
  lat: number;
  lng: number;
}

export interface UnplacedDivisionClub {
  clubId: number;
  clubName: string;
  venueName: string | null;
  postcode: string | null;
}

interface DivisionGroundsMapProps {
  markers: DivisionGroundMarker[];
  unplacedClubs: UnplacedDivisionClub[];
}

function bindClubPopup(marker: L.Marker, ground: DivisionGroundMarker) {
  const popup = L.DomUtil.create("div");
  const club = L.DomUtil.create("strong", "", popup);
  club.textContent = ground.clubName;
  const venue = L.DomUtil.create("div", "", popup);
  venue.textContent = ground.venueName;
  const postcode = L.DomUtil.create("div", "", popup);
  postcode.textContent = ground.postcode ?? "No postcode";
  marker.bindPopup(popup);
}

export default function DivisionGroundsMap({ markers, unplacedClubs }: DivisionGroundsMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRefs = useRef<L.Marker[]>([]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [52.5, -1.8],
      zoom: 6,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    function resizeMap() {
      requestAnimationFrame(() => {
        map.invalidateSize();
        if (markers.length > 0) {
          const bounds = L.latLngBounds(markers.map((ground) => [ground.lat, ground.lng]));
          map.fitBounds(bounds, { padding: [30, 30], maxZoom: 13 });
        }
      });
    }

    const detailsEl = detailsRef.current;
    detailsEl?.addEventListener("toggle", resizeMap);
    setTimeout(resizeMap, 100);

    return () => {
      detailsEl?.removeEventListener("toggle", resizeMap);
      markerRefs.current.forEach((marker) => marker.remove());
      markerRefs.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [markers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markerRefs.current.forEach((marker) => marker.remove());
    markerRefs.current = [];

    markers.forEach((ground) => {
      const marker = L.marker([ground.lat, ground.lng], { icon: adminVenuePinIcon }).addTo(map);
      bindClubPopup(marker, ground);
      markerRefs.current.push(marker);
    });

    if (markers.length > 0) {
      const bounds = L.latLngBounds(markers.map((ground) => [ground.lat, ground.lng]));
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 13 });
    }
  }, [markers]);

  return (
    <details
      ref={detailsRef}
      style={{
        borderBottom: "1px solid #dce3e2",
      }}
    >
      <summary
        style={{
          padding: "0.75rem 1rem",
          background: "#fbfcfc",
          fontSize: "0.9rem",
          fontWeight: 700,
          cursor: "pointer",
          color: "#147a4d",
        }}
      >
        Division grounds map ({markers.length} placed, {unplacedClubs.length} unplaced)
      </summary>
      <div style={{ padding: "0.75rem 1rem 1rem" }}>
        {markers.length > 0 ? (
          <div
            ref={mapContainerRef}
            style={{ height: "420px", width: "100%", borderRadius: "8px", border: "1px solid #dce3e2" }}
          />
        ) : (
          <p style={{ margin: 0, color: "#6f7e7a", fontSize: "14px" }}>
            No assigned clubs have primary venue coordinates yet.
          </p>
        )}
        {unplacedClubs.length > 0 && (
          <div style={{ marginTop: "0.75rem" }}>
            <h2 style={{ margin: "0 0 0.35rem", fontSize: "0.85rem" }}>Unplaced clubs</h2>
            <ul style={{ margin: 0, paddingLeft: "1.25rem", color: "#34413e", fontSize: "13px" }}>
              {unplacedClubs.map((club) => (
                <li key={club.clubId}>
                  {club.clubName} - {club.venueName ?? "No primary venue"}{club.postcode ? ` (${club.postcode})` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </details>
  );
}
