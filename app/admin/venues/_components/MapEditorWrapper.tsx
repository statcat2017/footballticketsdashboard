"use client";

import dynamic from "next/dynamic";

const VenueMapEditor = dynamic(() => import("./VenueMapEditor").then((m) => m.default), { ssr: false });

interface MapEditorWrapperProps {
  initialLat?: number;
  initialLng?: number;
  isApproximate: boolean;
  latInputId: string;
  lngInputId: string;
  approxInputId: string;
  mode: "edit" | "create";
  onCoordsChange?: (lat: number, lng: number, source: string) => void;
}

export function MapEditorWrapper(props: MapEditorWrapperProps) {
  return <VenueMapEditor {...props} />;
}
