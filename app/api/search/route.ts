import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdapterContext, dulwichHamletOfficialOpportunityAdapter } from "@/lib/ingestion";
import { rankTicketOpportunityLeads } from "@/lib/ranking";

const searchSchema = z.object({
  postcode: z.string().min(5),
  age: z.coerce.number().int().min(0).max(120)
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = searchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a valid postcode and age." },
      { status: 400 }
    );
  }

  try {
    const adapterResult = await dulwichHamletOfficialOpportunityAdapter.run(
      createAdapterContext({ now: new Date() })
    );

    return NextResponse.json({
      results: rankTicketOpportunityLeads(parsed.data, adapterResult.leads),
      diagnostics: adapterResult.diagnostics
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Search failed." },
      { status: 400 }
    );
  }
}
