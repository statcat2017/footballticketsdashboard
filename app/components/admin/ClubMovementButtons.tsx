"use client";

import { useState } from "react";
import { ClubMovementModal } from "./ClubMovementModal";

interface DivisionOption {
  id: number;
  name: string;
  level: number;
}

interface ClubOption {
  id: number;
  name: string;
}

interface ClubMovementButtonsProps {
  clubId: number;
  clubName: string;
  currentDivisionLevel: number;
  csrfToken: string;
  redirectDivisionId: number;
  promoteTargets: DivisionOption[];
  relegateTargets: DivisionOption[];
  migrateTargets: DivisionOption[];
  allClubsByDivision: Record<number, ClubOption[]>;
}

export function ClubMovementButtons({
  clubId,
  clubName,
  currentDivisionLevel,
  csrfToken,
  redirectDivisionId,
  promoteTargets,
  relegateTargets,
  migrateTargets,
  allClubsByDivision,
}: ClubMovementButtonsProps) {
  const [activeMovement, setActiveMovement] = useState<{
    type: "promote" | "relegate" | "migrate";
    targets: DivisionOption[];
  } | null>(null);

  const [modalClubs, setModalClubs] = useState<ClubOption[]>([]);

  const handleOpen = (type: "promote" | "relegate" | "migrate", targets: DivisionOption[]) => {
    setActiveMovement({ type, targets });
    if (targets.length === 1) {
      setModalClubs(allClubsByDivision[targets[0].id] ?? []);
    } else if (targets.length > 1) {
      setModalClubs([]);
    }
  };

  const handleClose = () => {
    setActiveMovement(null);
    setModalClubs([]);
  };

  const hasPromote = promoteTargets.length > 0;
  const hasRelegate = currentDivisionLevel <= 10;
  const hasMigrate = migrateTargets.length > 0;

  if (!hasPromote && !hasRelegate && !hasMigrate) {
    return null;
  }

  return (
    <>
      <div style={{ display: "flex", gap: "0.3rem", alignItems: "center" }}>
        {hasPromote && (
          <button
            type="button"
            onClick={() => handleOpen("promote", promoteTargets)}
            title="Promote to tier above"
            style={{
              border: "1px solid #147a4d",
              borderRadius: "4px",
              background: "#fff",
              color: "#147a4d",
              padding: "0.15rem 0.4rem",
              fontSize: "11px",
              fontWeight: 700,
              cursor: "pointer",
              lineHeight: 1,
            }}
          >
            &uarr;
          </button>
        )}
        {hasRelegate && (
          <button
            type="button"
            onClick={() => handleOpen("relegate", relegateTargets)}
            title={currentDivisionLevel === 10 ? "Unassign (below tier 10)" : "Relegate to tier below"}
            style={{
              border: "1px solid #a53a2d",
              borderRadius: "4px",
              background: "#fff",
              color: "#a53a2d",
              padding: "0.15rem 0.4rem",
              fontSize: "11px",
              fontWeight: 700,
              cursor: "pointer",
              lineHeight: 1,
            }}
          >
            &darr;
          </button>
        )}
        {hasMigrate && (
          <button
            type="button"
            onClick={() => handleOpen("migrate", migrateTargets)}
            title="Migrate to same tier"
            style={{
              border: "1px solid #6f7e7a",
              borderRadius: "4px",
              background: "#fff",
              color: "#6f7e7a",
              padding: "0.15rem 0.4rem",
              fontSize: "11px",
              fontWeight: 700,
              cursor: "pointer",
              lineHeight: 1,
            }}
          >
            &harr;
          </button>
        )}
      </div>
      {activeMovement && (
        <ClubMovementModal
          clubId={clubId}
          clubName={clubName}
          currentDivisionLevel={currentDivisionLevel}
          movementType={activeMovement.type}
          targetDivisions={activeMovement.targets}
          clubsInTargetDivision={modalClubs}
          csrfToken={csrfToken}
          redirectDivisionId={redirectDivisionId}
          onClose={handleClose}
        />
      )}
    </>
  );
}
