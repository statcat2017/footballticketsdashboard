"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const pinIcon = L.divIcon({
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="36" viewBox="0 0 24 36" fill="none">
    <path d="M12 1C5.9 1 1 5.9 1 12c0 8 11 22 11 22s11-14 11-22C23 5.9 18.1 1 12 1z" fill="#147a4d" stroke="#fff" stroke-width="2"/>
    <circle cx="12" cy="11" r="3.5" fill="#fff"/>
  </svg>`,
  className: "",
  iconSize: [24, 36],
  iconAnchor: [12, 36],
});

interface VenueMapEditorProps {
  initialLat?: number;
  initialLng?: number;
  isApproximate: boolean;
  latInputId: string;
  lngInputId: string;
  approxInputId: string;
  precisionInputId: string;
  mode: "edit" | "create";
  venueId?: number;
}

function setInputValue(id: string, value: string) {
  const el = document.getElementById(id) as HTMLInputElement | null;
  if (el) el.value = value;
}

function setSelectValue(id: string, value: string) {
  const el = document.getElementById(id) as HTMLSelectElement | null;
  if (el) el.value = value;
}

function setCheckbox(id: string, checked: boolean) {
  const el = document.getElementById(id) as HTMLInputElement | null;
  if (el) el.checked = checked;
}

export function VenueMapEditor({
  initialLat,
  initialLng,
  isApproximate,
  latInputId,
  lngInputId,
  approxInputId,
  precisionInputId,
  mode,
  venueId,
}: VenueMapEditorProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const wasApproximate = useRef(isApproximate);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [postcodeInput, setPostcodeInput] = useState(
    () => (document.getElementById("postcode") as HTMLInputElement)?.value ?? ""
  );

  const hasCoords =
    initialLat !== undefined &&
    initialLng !== undefined &&
    Number.isFinite(initialLat) &&
    Number.isFinite(initialLng);

  const summaryText =
    mode === "create"
      ? "Set coordinates on map"
      : isApproximate
        ? "Refine coordinates on map"
        : "Adjust coordinates on map";

  const defaultOpen = mode === "create" || isApproximate;

  function syncInputs(lat: number, lng: number, source: "map" | "postcode") {
    setInputValue(latInputId, lat.toFixed(6));
    setInputValue(lngInputId, lng.toFixed(6));

    if (source === "postcode") {
      setSelectValue(precisionInputId, "postcode");
      setCheckbox(approxInputId, false);
    } else {
      setSelectValue(precisionInputId, "ground_approximate");
      if (!wasApproximate.current && mode === "edit") {
        setCheckbox(approxInputId, true);
      }
    }
  }

  function placeMarker(latlng: L.LatLng) {
    if (markerRef.current) {
      markerRef.current.setLatLng(latlng);
      return;
    }

    markerRef.current = L.marker(latlng, { draggable: true, icon: pinIcon }).addTo(mapRef.current!);
    markerRef.current.on("dragend", () => {
      if (markerRef.current) {
        const { lat, lng } = markerRef.current.getLatLng();
        syncInputs(lat, lng, "map");
      }
    });
  }

  function placeMarkerAndSync(latlng: L.LatLng, source: "map" | "postcode") {
    placeMarker(latlng);
    syncInputs(latlng.lat, latlng.lng, source);
  }

  function handleConfirmLocation() {
    if (markerRef.current) {
      const { lat, lng } = markerRef.current.getLatLng();
      syncInputs(lat, lng, "map");
    }
    const details = detailsRef.current;
    if (details) details.open = false;
  }

  async function handleLookupPostcode() {
    const pc = postcodeInput.trim();
    if (!pc) return;

    setLookupLoading(true);
    try {
      if (mode === "edit" && venueId) {
        const res = await fetch(`/api/admin/venues/${venueId}/geocode`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postcode: pc }),
        });
        if (!res.ok) return;
        const data = await res.json();
        const lat: number | undefined = data.latitude;
        const lng: number | undefined = data.longitude;
        if (lat == null || lng == null) return;

        mapRef.current?.setView([lat, lng], 15);
        placeMarkerAndSync(L.latLng(lat, lng), "postcode");
      } else {
        const res = await fetch(
          `https://api.postcodes.io/postcodes/${pc.replace(/\s+/g, "")}`
        );
        const data = await res.json();
        const lat: number | undefined = data.result?.latitude;
        const lng: number | undefined = data.result?.longitude;
        if (lat == null || lng == null) return;

        mapRef.current?.setView([lat, lng], 15);
        placeMarkerAndSync(L.latLng(lat, lng), "postcode");
      }
    } catch {
      // geocoding failure — silently ignore
    } finally {
      setLookupLoading(false);
    }
  }

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const center: L.LatLngExpression = hasCoords
      ? [initialLat!, initialLng!]
      : [51.5074, -0.1278];

    const map = L.map(mapContainerRef.current, {
      center,
      zoom: hasCoords ? 15 : 10,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    if (hasCoords) {
      placeMarker(L.latLng(initialLat!, initialLng!));
    }

    map.on("click", (e: L.LeafletMouseEvent) => {
      placeMarkerAndSync(e.latlng, "map");
    });
    setTimeout(() => map.invalidateSize(), 100);

    const detailsEl = detailsRef.current;
    function onToggle() {
      requestAnimationFrame(() => map.invalidateSize());
    }
    detailsEl?.addEventListener("toggle", onToggle);

    return () => {
      detailsEl?.removeEventListener("toggle", onToggle);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <details
      ref={detailsRef}
      open={defaultOpen}
      style={{
        border: "1px solid #dce3e2",
        borderRadius: "8px",
        overflow: "hidden",
        marginBottom: "1.5rem",
      }}
    >
      <summary
        style={{
          padding: "0.75rem 1rem",
          background: "#f5f7f7",
          fontSize: "0.9rem",
          fontWeight: 700,
          cursor: "pointer",
          color: mode === "create" || isApproximate ? "#0e5737" : "#147a4d",
        }}
      >
        {summaryText}
      </summary>
      <div style={{ padding: "0.75rem" }}>
        <div
          style={{
            marginBottom: "0.5rem",
            display: "flex",
            gap: "0.5rem",
            alignItems: "center",
          }}
        >
          <input
            type="text"
            value={postcodeInput}
            onChange={(e) => setPostcodeInput(e.target.value)}
            placeholder="e.g. SW1A 1AA"
            onKeyDown={(e) => { if (e.key === "Enter") handleLookupPostcode(); }}
            style={{
              flex: 1,
              padding: "0.45rem 0.7rem",
              border: "1px solid #dce3e2",
              borderRadius: "6px",
              fontSize: "14px",
              fontFamily: "monospace",
            }}
          />
          <button
            type="button"
            onClick={handleLookupPostcode}
            disabled={lookupLoading}
            style={{
              border: "1px solid #147a4d",
              borderRadius: "7px",
              background: "#147a4d",
              color: "#fff",
              padding: "0.4rem 0.8rem",
              fontSize: "13px",
              fontWeight: 700,
              cursor: lookupLoading ? "wait" : "pointer",
              opacity: lookupLoading ? 0.7 : 1,
              whiteSpace: "nowrap",
            }}
          >
            {lookupLoading ? "Looking up..." : "Look up"}
          </button>
          <button
            type="button"
            onClick={handleConfirmLocation}
            style={{
              border: "1px solid #0e5737",
              borderRadius: "7px",
              background: "#0e5737",
              color: "#fff",
              padding: "0.4rem 0.8rem",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Confirm location
          </button>
        </div>
        <div
          ref={mapContainerRef}
          style={{ height: "400px", width: "100%", borderRadius: "6px" }}
        />
        <p style={{ margin: "0.5rem 0 0", fontSize: "13px", color: "#6f7e7a" }}>
          Click on the map or drag the pin to set coordinates.
          {mode === "edit" && !isApproximate && (
            <>
              {" "}
              Moving the pin will mark this venue&apos;s coordinates as approximate.
            </>
          )}
        </p>
      </div>
    </details>
  );
}

export default VenueMapEditor;
