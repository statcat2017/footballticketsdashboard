import { getAdminSessionFromCookies } from "@/lib/admin/auth";
import { SearchDashboard } from "@/app/components/SearchDashboard";

export default async function Home() {
  const session = await getAdminSessionFromCookies();
  return <SearchDashboard showAdminLink={session !== null} />;
}
