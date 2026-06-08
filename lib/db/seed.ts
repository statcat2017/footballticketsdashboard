import { initializeAppDatabase, SEED_DATA } from "./seed-data.ts";
import type { AppDatabase } from "./adapter.ts";

export { SEED_DATA };

export async function seedDatabase(db: AppDatabase): Promise<void> {
  return initializeAppDatabase(db);
}
