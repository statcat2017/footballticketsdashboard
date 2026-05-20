import { notFound } from "next/navigation";
import { getDatabase } from "@/lib/db/client";
import { getDivisionDetailByCode } from "@/lib/db/divisions";
import { DivisionDetail } from "./DivisionDetail";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ code: string }>;
}

export default async function DivisionDetailPage({ params }: Props) {
  const { code } = await params;
  const db = await getDatabase();
  const division = await getDivisionDetailByCode(db, code);

  if (!division) {
    notFound();
  }

  return <DivisionDetail division={division} />;
}
