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
  precisionInputId: string;
  mode: "edit" | "create";
  venueId?: number;
}

export function MapEditorWrapper(props: MapEditorWrapperProps) {
  return <VenueMapEditor {...props} />;
}
