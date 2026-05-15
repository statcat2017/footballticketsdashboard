import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPageSession } from "@/lib/admin/auth";
import { createAdminCsrfToken } from "@/lib/admin/csrf";
import { getAdminVenue } from "@/lib/admin/venues";
import { VenueMapEditor } from "../_components/VenueMapEditor";

export const dynamic = "force-dynamic";

export default async function AdminVenueDetailPage(props: { params: Promise<{ id: string }>, searchParams: Promise<{ error?: string }> }) {
  const { id } = await props.params;
  const { error } = await props.searchParams;
  const venueId = Number(id);

  if (!Number.isInteger(venueId) || venueId <= 0) {
    notFound();
  }

  await requireAdminPageSession();
  const csrfToken = await createAdminCsrfToken();

  const data = await getAdminVenue(venueId);

  if (!data) {
    notFound();
  }

  const isShared = data.sharingClubs.length > 1;

  return (
    <main style={{ maxWidth: "40rem", margin: "0 auto", padding: "0 1rem 3rem", fontFamily: "system-ui, sans-serif" }}>
      <header style={{
        padding: "1.25rem 0",
        borderBottom: "1px solid #dce3e2",
        marginBottom: "1.5rem"
      }}>
        <Link href="/admin/venues" style={{
          color: "#6f7e7a",
          fontSize: "13px",
          textDecoration: "none",
          fontWeight: 600
        }}>&larr; Venues</Link>
        <h1 style={{ margin: "0.25rem 0 0", fontSize: "1.5rem" }}>{data.venue.name}</h1>
        <p style={{ margin: "0.25rem 0 0", color: "#6f7e7a", fontSize: "14px" }}>
          {data.venue.postcode}
          {data.venue.is_approximate === 1 && <span style={{ marginLeft: "0.5rem", color: "#a76800", fontWeight: 600 }}>Approximate coordinates</span>}
        </p>
      </header>

      {error && (
        <div style={{
          border: "1px solid #f0beb7",
          borderRadius: "8px",
          background: "#fde9e5",
          padding: "0.75rem 1rem",
          marginBottom: "1.5rem",
          fontSize: "14px",
          color: "#a53a2d"
        }}>
          {error}
        </div>
      )}

      {isShared && (
        <div style={{
          border: "1px solid #f0beb7",
          borderRadius: "8px",
          background: "#fde9e5",
          padding: "0.75rem 1rem",
          marginBottom: "1.5rem",
          fontSize: "14px",
          color: "#a53a2d"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: "0.25rem" }}>
            <span>&#9888;</span> <strong>Shared venue</strong>
          </div>
          <p style={{ margin: "0 0 0.25rem" }}>
            This venue is currently used by {data.sharingClubs.length} clubs:
          </p>
          <ul style={{ margin: 0, paddingLeft: "1.5rem" }}>
            {data.sharingClubs.map((club) => (
              <li key={club.id}>
                <Link href={`/admin/clubs/${club.id}`} style={{ color: "#a53a2d" }}>{club.name}</Link>
              </li>
            ))}
          </ul>
          <p style={{ margin: "0.25rem 0 0", fontSize: "13px" }}>
            Changes will affect all clubs listed above.
          </p>
        </div>
      )}

      {data.sharingClubs.length === 1 && (
        <div style={{
          border: "1px solid #dce3e2",
          borderRadius: "8px",
          background: "#f5f7f7",
          padding: "0.5rem 1rem",
          marginBottom: "1.5rem",
          fontSize: "13px",
          color: "#6f7e7a"
        }}>
          Used by: <Link href={`/admin/clubs/${data.sharingClubs[0].id}`} style={{ color: "#0e5737", fontWeight: 600 }}>{data.sharingClubs[0].name}</Link>
        </div>
      )}

      <VenueMapEditor
        initialLat={data.venue.latitude}
        initialLng={data.venue.longitude}
        isApproximate={data.venue.is_approximate === 1}
        latInputId="latitude"
        lngInputId="longitude"
        approxInputId="is_approximate"
        mode="edit"
      />

      <section style={{
        border: "1px solid #dce3e2",
        borderRadius: "8px",
        overflow: "hidden"
      }}>
        <div style={{
          padding: "0.75rem 1rem",
          background: "#f5f7f7",
          borderBottom: "1px solid #dce3e2",
          fontSize: "0.9rem",
          fontWeight: 700
        }}>
          Venue Details
        </div>
        <form method="post" action={`/api/admin/venues/${venueId}`} style={{ padding: "1rem", display: "grid", gap: "1rem" }}>
          <input type="hidden" name="csrf" value={csrfToken} />

          {isShared && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input id="confirmed" name="confirmed" type="checkbox" value="true" />
              <label htmlFor="confirmed" style={{ fontSize: "14px", fontWeight: 600, color: "#a53a2d" }}>
                I understand — update venue for all clubs
              </label>
            </div>
          )}

          <div style={{ display: "grid", gap: "0.25rem" }}>
            <label htmlFor="name" style={{ fontSize: "14px", fontWeight: 700, color: "#34413e" }}>Name</label>
            <input id="name" name="name" type="text" defaultValue={data.venue.name}
              style={{ padding: "0.5rem 0.75rem", border: "1px solid #dce3e2", borderRadius: "6px", fontSize: "14px" }}
            />
          </div>

          <div style={{ display: "grid", gap: "0.25rem" }}>
            <label htmlFor="postcode" style={{ fontSize: "14px", fontWeight: 700, color: "#34413e" }}>Postcode</label>
            <input id="postcode" name="postcode" type="text" defaultValue={data.venue.postcode}
              style={{ padding: "0.5rem 0.75rem", border: "1px solid #dce3e2", borderRadius: "6px", fontSize: "14px" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div style={{ display: "grid", gap: "0.25rem" }}>
              <label htmlFor="latitude" style={{ fontSize: "14px", fontWeight: 700, color: "#34413e" }}>Latitude</label>
              <input id="latitude" name="latitude" type="number" step="any" defaultValue={data.venue.latitude}
                style={{ padding: "0.5rem 0.75rem", border: "1px solid #dce3e2", borderRadius: "6px", fontSize: "14px" }}
              />
            </div>
            <div style={{ display: "grid", gap: "0.25rem" }}>
              <label htmlFor="longitude" style={{ fontSize: "14px", fontWeight: 700, color: "#34413e" }}>Longitude</label>
              <input id="longitude" name="longitude" type="number" step="any" defaultValue={data.venue.longitude}
                style={{ padding: "0.5rem 0.75rem", border: "1px solid #dce3e2", borderRadius: "6px", fontSize: "14px" }}
              />
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <input id="is_approximate" name="is_approximate" type="checkbox" value="1"
              defaultChecked={data.venue.is_approximate === 1}
            />
            <label htmlFor="is_approximate" style={{ fontSize: "14px", color: "#34413e" }}>
              Coordinates are approximate
            </label>
          </div>

          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
            <button type="submit" style={{
              border: "1px solid #147a4d",
              borderRadius: "7px",
              background: "#147a4d",
              color: "#fff",
              padding: "0.5rem 1.25rem",
              fontSize: "14px",
              fontWeight: 700,
              cursor: "pointer"
            }}>
              Save Changes
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
