"use client";

import { useState, useCallback } from "react";

interface DivisionOption {
  id: number;
  name: string;
  level: number;
}

interface ClubOption {
  id: number;
  name: string;
}

interface ClubMovementModalProps {
  clubId: number;
  clubName: string;
  currentDivisionLevel: number;
  movementType: "promote" | "relegate" | "migrate";
  targetDivisions: DivisionOption[];
  clubsInTargetDivision: ClubOption[];
  csrfToken: string;
  redirectDivisionId: number;
  onClose: () => void;
}

export function ClubMovementModal({
  clubId,
  clubName,
  currentDivisionLevel,
  movementType,
  targetDivisions,
  clubsInTargetDivision,
  csrfToken,
  redirectDivisionId,
  onClose,
}: ClubMovementModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedTargetDivisionId, setSelectedTargetDivisionId] = useState("");
  const [selectedSwapClubId, setSelectedSwapClubId] = useState("");
  const [swapMode, setSwapMode] = useState<"swap" | "none">("swap");

  const handleTargetDivisionInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const match = targetDivisions.find((d) => d.name === e.target.value);
      setSelectedTargetDivisionId(match ? String(match.id) : "");
    },
    [targetDivisions]
  );

  const handleSwapClubInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const match = clubsInTargetDivision.find((c) => c.name === e.target.value);
      setSelectedSwapClubId(match ? String(match.id) : "");
    },
    [clubsInTargetDivision]
  );

  const handleContinue = () => {
    if (!selectedTargetDivisionId) return;
    setStep(2);
  };

  const movementLabel = movementType === "promote" ? "Promote" : movementType === "relegate" ? "Relegate" : "Migrate";
  const movementVerb = movementType === "promote" ? "promote" : movementType === "relegate" ? "relegate" : "migrate";

  const isTier10Relegate = movementType === "relegate" && currentDivisionLevel === 10 && targetDivisions.length === 0;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "10px",
          padding: "1.5rem",
          maxWidth: "480px",
          width: "90%",
          boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>
            {movementLabel} {clubName}
          </h2>
          <button
            onClick={onClose}
            style={{
              border: "none",
              background: "none",
              fontSize: "1.2rem",
              cursor: "pointer",
              color: "#6f7e7a",
              padding: "0 0.25rem",
            }}
          >
            &times;
          </button>
        </div>

        {isTier10Relegate ? (
          <form method="post" action="/api/admin/club-movement">
            <input type="hidden" name="csrf" value={csrfToken} />
            <input type="hidden" name="club_id" value={clubId} />
            <input type="hidden" name="movement_type" value="relegate" />
            <input type="hidden" name="target_division_id" value="" />
            <input type="hidden" name="swap_club_id" value="" />
            <input type="hidden" name="redirect_division_id" value={redirectDivisionId} />
            <p style={{ fontSize: "14px", color: "#6f7e7a", marginBottom: "1rem" }}>
              This club is at tier 10. Relegating will unassign them from the pyramid (no modeled divisions below tier 10).
            </p>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  border: "1px solid #dce3e2",
                  borderRadius: "7px",
                  background: "#fff",
                  padding: "0.4rem 0.8rem",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{
                  border: "1px solid #a53a2d",
                  borderRadius: "7px",
                  background: "#a53a2d",
                  color: "#fff",
                  padding: "0.4rem 0.8rem",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Unassign club
              </button>
            </div>
          </form>
        ) : step === 1 ? (
          <>
            <p style={{ fontSize: "14px", color: "#6f7e7a", marginBottom: "0.75rem" }}>
              Select target division to {movementVerb} {clubName} into:
            </p>
            {targetDivisions.length === 1 ? (
              <div style={{
                padding: "0.5rem 0.75rem",
                background: "#f5f7f7",
                borderRadius: "6px",
                fontSize: "14px",
                fontWeight: 600,
                marginBottom: "1rem",
              }}>
                {targetDivisions[0].name} (Level {targetDivisions[0].level})
              </div>
            ) : (
              <div style={{ marginBottom: "1rem" }}>
                <input
                  list={`target-divs-${clubId}`}
                  onChange={handleTargetDivisionInput}
                  placeholder="Search divisions..."
                  style={{
                    padding: "0.4rem 0.5rem",
                    border: "1px solid #dce3e2",
                    borderRadius: "6px",
                    fontSize: "14px",
                    background: "#fff",
                    width: "100%",
                    boxSizing: "border-box",
                  }}
                />
                <datalist id={`target-divs-${clubId}`}>
                  {targetDivisions.map((d) => (
                    <option key={d.id} value={d.name} />
                  ))}
                </datalist>
              </div>
            )}
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  border: "1px solid #dce3e2",
                  borderRadius: "7px",
                  background: "#fff",
                  padding: "0.4rem 0.8rem",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleContinue}
                disabled={targetDivisions.length > 1 && !selectedTargetDivisionId}
                style={{
                  border: "1px solid #147a4d",
                  borderRadius: "7px",
                  background: (targetDivisions.length === 1 || selectedTargetDivisionId) ? "#147a4d" : "#94c7a8",
                  color: "#fff",
                  padding: "0.4rem 0.8rem",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: (targetDivisions.length === 1 || selectedTargetDivisionId) ? "pointer" : "default",
                }}
              >
                Continue
              </button>
            </div>
          </>
        ) : (
          <form method="post" action="/api/admin/club-movement">
            <input type="hidden" name="csrf" value={csrfToken} />
            <input type="hidden" name="club_id" value={clubId} />
            <input type="hidden" name="movement_type" value={movementType} />
            <input type="hidden" name="target_division_id" value={selectedTargetDivisionId} />
            <input type="hidden" name="redirect_division_id" value={redirectDivisionId} />
            <p style={{ fontSize: "14px", color: "#6f7e7a", marginBottom: "0.75rem" }}>
              Select a club to swap with, or move without swapping:
            </p>
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem", fontSize: "14px" }}>
                <input
                  type="radio"
                  name="swap_mode"
                  value="none"
                  checked={swapMode === "none"}
                  onChange={() => setSwapMode("none")}
                />
                No swap (manual move)
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem", fontSize: "14px" }}>
                <input
                  type="radio"
                  name="swap_mode"
                  value="swap"
                  checked={swapMode === "swap"}
                  onChange={() => setSwapMode("swap")}
                />
                Swap with a club
              </label>
              {swapMode === "swap" && (
                <div style={{ marginTop: "0.5rem" }}>
                  <input
                    list={`swap-clubs-${clubId}`}
                    onChange={handleSwapClubInput}
                    placeholder="Search clubs in target division..."
                    style={{
                      padding: "0.4rem 0.5rem",
                      border: "1px solid #dce3e2",
                      borderRadius: "6px",
                      fontSize: "14px",
                      background: "#fff",
                      width: "100%",
                      boxSizing: "border-box",
                    }}
                  />
                  <datalist id={`swap-clubs-${clubId}`}>
                    {clubsInTargetDivision.map((c) => (
                      <option key={c.id} value={c.name} />
                    ))}
                  </datalist>
                </div>
              )}
            </div>
            <input
              type="hidden"
              name="swap_club_id"
              value={swapMode === "none" ? "" : selectedSwapClubId}
            />
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setStep(1)}
                style={{
                  border: "1px solid #dce3e2",
                  borderRadius: "7px",
                  background: "#fff",
                  padding: "0.4rem 0.8rem",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Back
              </button>
              <button
                type="submit"
                disabled={swapMode === "swap" && !selectedSwapClubId}
                style={{
                  border: "1px solid #147a4d",
                  borderRadius: "7px",
                  background: (swapMode === "none" || selectedSwapClubId) ? "#147a4d" : "#94c7a8",
                  color: "#fff",
                  padding: "0.4rem 0.8rem",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: (swapMode === "none" || selectedSwapClubId) ? "pointer" : "default",
                }}
              >
                {movementLabel} club
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
