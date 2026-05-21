import type { FixtureSourceAdapter, SourceType } from "../types.ts";
import { csvFixtureSourceAdapter } from "./csv.ts";
import { htmlTableFixtureSourceAdapter } from "./htmlTable.ts";

export const fixtureSourceAdapters = [
  csvFixtureSourceAdapter,
  htmlTableFixtureSourceAdapter,
] as const satisfies readonly FixtureSourceAdapter[];

export function getFixtureSourceAdapter(sourceType: SourceType): FixtureSourceAdapter | undefined {
  return fixtureSourceAdapters.find((adapter) => adapter.sourceType === sourceType);
}
