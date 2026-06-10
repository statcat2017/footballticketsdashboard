import { NextResponse } from "next/server";

function firstHeaderValue(value: string | null): string | undefined {
  return value
    ?.split(",")
    .map((part) => part.trim())
    .find(Boolean);
}

function configuredBaseUrl(): URL | undefined {
  const value = process.env.APP_BASE_URL?.trim();
  if (!value) return undefined;

  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}

function requestBaseUrl(request: Request): URL {
  const configured = configuredBaseUrl();
  if (configured) return configured;

  const currentUrl = new URL(request.url);
  const host = firstHeaderValue(request.headers.get("x-forwarded-host"))
    ?? firstHeaderValue(request.headers.get("host"))
    ?? currentUrl.host;
  const protocol = firstHeaderValue(request.headers.get("x-forwarded-proto"))
    ?? currentUrl.protocol.replace(/:$/, "")
    ?? "https";

  return new URL(`${protocol}://${host}`);
}

export function adminUrl(request: Request, path: string | URL): URL {
  if (path instanceof URL) return path;

  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(path)) {
    return new URL("/", requestBaseUrl(request));
  }

  return new URL(path, requestBaseUrl(request));
}

export function adminRedirect(request: Request, path: string | URL, status = 303): NextResponse {
  return NextResponse.redirect(adminUrl(request, path), { status });
}
