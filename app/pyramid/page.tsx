import { getDatabase } from "@/lib/db/client";
import { getPyramidExplorerData } from "@/lib/db/pyramid-explorer";
import { PyramidExplorer } from "./PyramidExplorer";

export const dynamic = "force-dynamic";

export default async function PyramidPage() {
  const db = await getDatabase();
  const data = await getPyramidExplorerData(db);

  return <PyramidExplorer data={data} />;
}
