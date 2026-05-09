import type { ComplianceDecision } from "@/lib/ingestion/adapter-contract";

const protectedPathMarkers = [
  "account",
  "basket",
  "cart",
  "checkout",
  "exchange",
  "login",
  "queue",
  "seat-map",
  "seatmap",
  "signin",
  "sign-in"
];

export function isPublicHttpUrl(sourceUrl: string): boolean {
  try {
    const parsedUrl = new URL(sourceUrl);
    return parsedUrl.protocol === "https:" || parsedUrl.protocol === "http:";
  } catch {
    return false;
  }
}

export function isProtectedTicketingUrl(sourceUrl: string): boolean {
  if (!isPublicHttpUrl(sourceUrl)) {
    return true;
  }

  const parsedUrl = new URL(sourceUrl);
  const normalizedPath = parsedUrl.pathname.toLowerCase();

  return protectedPathMarkers.some((marker) => normalizedPath.includes(marker));
}

export function evaluateSourceCompliance(sourceUrl: string): ComplianceDecision {
  if (!isPublicHttpUrl(sourceUrl)) {
    return {
      allowed: false,
      code: "blocked",
      message: "Source URL must be public HTTP(S).",
      sourceUrl
    };
  }

  if (isProtectedTicketingUrl(sourceUrl)) {
    return {
      allowed: false,
      code: "blocked",
      message: "Source URL appears to require a protected account, queue, basket, checkout, exchange, or seat-map flow.",
      sourceUrl
    };
  }

  return { allowed: true, sourceUrl };
}
