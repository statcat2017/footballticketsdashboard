import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPageSession } from "@/lib/admin/auth";
import { createAdminCsrfToken } from "@/lib/admin/csrf";
import { getAdminVenue } from "@/lib/admin/venues";
import { MapEditorWrapper } from "../_components/MapEditorWrapper";

export const dynamic = "force-dynamic";

export default async function AdminVenueDetailPage(props: { params: Promise<{ id: string }>, searchParams: Promise<{ error?: string; travelInvalidated?: string }> }) {
  const { id } = await props.params;
  const { error, travelInvalidated } = await props.searchParams;
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
  const precision = data.venue.coordinate_precision ?? "unknown";
  const precisionLabel = precision === "ground_approximate"
    ? "Ground located"
    : precision.charAt(0).toUpperCase() + precision.slice(1).replace("_", " ");

  const precisionColor =
    precision === "exact" || precision === "ground_approximate" ? "#0e5737" :
    precision === "postcode" ? "#1a6b9c" :
    "#6f7e7a";

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
          <span style={{
            marginLeft: "0.5rem",
            padding: "0.1rem 0.4rem",
            borderRadius: "4px",
            fontSize: "11px",
            fontWeight: 600,
            background: precisionColor + "18",
            color: precisionColor,
            border: `1px solid ${precisionColor}40`
          }}>
            {precisionLabel}
          </span>
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

      {travelInvalidated && (
        <div style={{
          border: "1px solid #f0d5b7",
          borderRadius: "8px",
          background: "#fdf3e9",
          padding: "0.75rem 1rem",
          marginBottom: "1.5rem",
          fontSize: "14px",
          color: "#8a5a00"
        }}>
          Travel cache invalidated: {travelInvalidated} row{travelInvalidated !== "1" ? "s" : ""} removed. Travel estimates will be recalculated on next search.
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

      <MapEditorWrapper
        initialLat={data.venue.latitude}
        initialLng={data.venue.longitude}
        initialPostcode={data.venue.postcode}
        isApproximate={data.venue.is_approximate === 1}
        latInputId="latitude"
        lngInputId="longitude"
        approxInputId="is_approximate"
        precisionInputId="coordinate_precision"
        venueId={venueId}
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

          <div style={{ display: "grid", gap: "0.25rem" }}>
            <label htmlFor="coordinate_precision" style={{ fontSize: "14px", fontWeight: 700, color: "#34413e" }}>Coordinate Precision</label>
            <select id="coordinate_precision" name="coordinate_precision" defaultValue={data.venue.coordinate_precision ?? "unknown"}
              style={{ padding: "0.5rem 0.75rem", border: "1px solid #dce3e2", borderRadius: "6px", fontSize: "14px", background: "#fff" }}
            >
              <option value="exact">Exact — surveyed or official source</option>
              <option value="postcode">Postcode — from postcode lookup</option>
              <option value="ground_approximate">Ground located — manually placed coordinates</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>

          <div style={{ display: "grid", gap: "0.25rem" }}>
            <label htmlFor="coordinates_notes" style={{ fontSize: "14px", fontWeight: 700, color: "#34413e" }}>Coordinate Notes</label>
            <textarea id="coordinates_notes" name="coordinates_notes" defaultValue={data.venue.coordinates_notes ?? ""}
              rows={3}
              style={{ padding: "0.5rem 0.75rem", border: "1px solid #dce3e2", borderRadius: "6px", fontSize: "14px", fontFamily: "inherit", resize: "vertical" }}
              placeholder="e.g. Source URL, verification method, known issues..."
            />
          </div>

          <div style={{
            border: "1px solid #dce3e2",
            borderRadius: "8px",
            background: "#f5f7f7",
            padding: "0.75rem 1rem",
            fontSize: "13px",
            color: "#6f7e7a"
          }}>
            <div style={{ fontWeight: 600, marginBottom: "0.25rem", color: "#34413e" }}>Coordinate Confirmation</div>
            <p style={{ margin: "0 0 0.5rem" }}>
              If you changed the coordinates above, confirm below to save.
              Moving coordinates more than 1 mile will invalidate cached travel estimates.
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input id="coords_confirmed" name="coords_confirmed" type="checkbox" value="true" />
              <label htmlFor="coords_confirmed" style={{ fontSize: "14px", fontWeight: 600, color: "#34413e" }}>
                I confirm the coordinates are correct
              </label>
            </div>
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

      <section style={{
        border: "1px solid #e0b3a8", borderRadius: "8px",
        background: "#fdf6f5", padding: "1rem", marginTop: "1.5rem"
      }}>
        <p style={{ margin: "0 0 0.5rem", fontWeight: 600, fontSize: "14px", color: "#a53a2d" }}>
          Danger zone
        </p>
        <p style={{ margin: "0 0 0.75rem", fontSize: "13px", color: "#6f7e7a" }}>
          Delete this venue. Cannot delete if it is assigned as a club&apos;s primary ground.
        </p>
        <form method="post" action={`/api/admin/venues/${data.venue.id}/delete`} id="delete-venue-form">
          <input type="hidden" name="csrf" value={csrfToken} />
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "14px", cursor: "pointer", marginBottom: "0.75rem" }}>
            <input type="checkbox" name="confirm" value="1" required />
            I understand this will permanently delete this venue.
          </label>
          <button type="submit" style={{
            border: "1px solid #c0392b", borderRadius: "7px",
            background: "#e74c3c", color: "#fff",
            padding: "0.5rem 1.25rem", fontSize: "14px", fontWeight: 700, cursor: "pointer"
          }}>
            Delete venue
          </button>
        </form>
        <script dangerouslySetInnerHTML={{
          __html: `document.getElementById("delete-venue-form")?.addEventListener("submit",function(e){if(!confirm("Delete this venue? This cannot be undone."))e.preventDefault()})`
        }} />
      </section>
    </main>
  );
}
