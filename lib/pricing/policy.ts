export type PriceConfirmationReason = "missing_checked_date" | "older_than_threshold" | "different_season";

export interface PriceConfirmationPolicy {
  maxAgeDays: number;
}

export const DEFAULT_PRICE_CONFIRMATION_POLICY: PriceConfirmationPolicy = {
  maxAgeDays: 90
};

interface PriceFreshnessInput {
  checkedAt: string | null;
  priceSeasonLabel: string | null;
  fixtureSeasonLabel: string | null;
  maxAgeDays: number;
  now?: Date;
}

export function priceConfirmationReasons(input: PriceFreshnessInput): PriceConfirmationReason[] {
  const reasons: PriceConfirmationReason[] = [];
  const checkedDate = input.checkedAt?.slice(0, 10);
  const checkedDateMs = checkedDate ? Date.parse(`${checkedDate}T00:00:00.000Z`) : Number.NaN;

  if (!Number.isFinite(checkedDateMs)) {
    reasons.push("missing_checked_date");
  } else {
    const currentDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(input.now ?? new Date());
    const currentDateMs = Date.parse(`${currentDate}T00:00:00.000Z`);
    const ageInDays = Math.floor((currentDateMs - checkedDateMs) / 86_400_000);
    if (ageInDays > input.maxAgeDays) reasons.push("older_than_threshold");
  }

  if (input.priceSeasonLabel && input.fixtureSeasonLabel && input.priceSeasonLabel !== input.fixtureSeasonLabel) {
    reasons.push("different_season");
  }

  return reasons;
}
