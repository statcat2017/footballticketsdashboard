import { getDatabase } from "@/lib/db/client";
import { listDivisions } from "@/lib/db/divisions";
import { DivisionList } from "./DivisionList";

export const dynamic = "force-dynamic";

export default async function DivisionsPage() {
  const db = await getDatabase();
  const divisions = await listDivisions(db);

  return <DivisionList divisions={divisions} />;
}
