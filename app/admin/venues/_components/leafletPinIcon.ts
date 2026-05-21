import L from "leaflet";

export const adminVenuePinIcon = L.divIcon({
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="36" viewBox="0 0 24 36" fill="none">
    <path d="M12 1C5.9 1 1 5.9 1 12c0 8 11 22 11 22s11-14 11-22C23 5.9 18.1 1 12 1z" fill="#147a4d" stroke="#fff" stroke-width="2"/>
    <circle cx="12" cy="11" r="3.5" fill="#fff"/>
  </svg>`,
  className: "",
  iconSize: [24, 36],
  iconAnchor: [12, 36],
});
