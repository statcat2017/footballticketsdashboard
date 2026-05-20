"use client";

import dynamic from "next/dynamic";
import type { DivisionGroundMarker, UnplacedDivisionClub } from "./DivisionGroundsMap";

const DivisionGroundsMap = dynamic(() => import("./DivisionGroundsMap"), { ssr: false });

interface DivisionGroundsMapWrapperProps {
  markers: DivisionGroundMarker[];
  unplacedClubs: UnplacedDivisionClub[];
}

export function DivisionGroundsMapWrapper(props: DivisionGroundsMapWrapperProps) {
  return <DivisionGroundsMap {...props} />;
}
