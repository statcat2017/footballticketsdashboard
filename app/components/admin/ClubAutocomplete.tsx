"use client";

import { useState, useCallback } from "react";

interface ClubOption {
  id: number;
  name: string;
  venueName: string | null;
}

export function ClubAutocomplete({
  divisionId,
  unassignedClubs,
  csrfToken,
  maxCapacity,
  clubCount,
}: {
  divisionId: number;
  unassignedClubs: ClubOption[];
  csrfToken: string;
  maxCapacity: number;
  clubCount: number;
}) {
  const [selectedId, setSelectedId] = useState("");

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const match = unassignedClubs.find((c) => c.name === e.target.value);
      setSelectedId(match ? String(match.id) : "");
    },
    [unassignedClubs]
  );

  if (clubCount >= maxCapacity) {
    return (
      <p style={{ color: "#a76800", fontSize: "13px", fontWeight: 600 }}>
        Division is at capacity ({maxCapacity} clubs).
      </p>
    );
  }

  if (unassignedClubs.length === 0) {
    return (
      <p style={{ color: "#6f7e7a", fontSize: "13px" }}>
        No unassigned clubs available to add.
      </p>
    );
  }

  return (
    <form
      method="post"
      action="/api/admin/assign-club"
      style={{ display: "inline-flex", gap: "0.5rem", alignItems: "center" }}
    >
      <input type="hidden" name="csrf" value={csrfToken} />
      <input type="hidden" name="division_id" value={divisionId.toString()} />
      <input type="hidden" name="redirect_division_id" value={divisionId.toString()} />
      <input type="hidden" name="club_id" value={selectedId} />
      <input
        list={`clubs-${divisionId}`}
        onChange={handleInput}
        placeholder={`Search ${unassignedClubs.length} unassigned clubs...`}
        style={{
          padding: "0.3rem 0.5rem",
          border: "1px solid #dce3e2",
          borderRadius: "6px",
          fontSize: "13px",
          background: "#fff",
          minWidth: "240px",
        }}
      />
      <datalist id={`clubs-${divisionId}`}>
        {unassignedClubs.map((c) => (
          <option key={c.id} value={c.name} />
        ))}
      </datalist>
      <button
        type="submit"
        disabled={!selectedId}
        style={{
          border: "1px solid #147a4d",
          borderRadius: "7px",
          background: selectedId ? "#147a4d" : "#94c7a8",
          color: "#fff",
          padding: "0.3rem 0.7rem",
          fontSize: "12px",
          fontWeight: 700,
          cursor: selectedId ? "pointer" : "default",
        }}
      >
        Assign
      </button>
    </form>
  );
}
