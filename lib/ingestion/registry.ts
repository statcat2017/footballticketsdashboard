import type {
  TicketSourceAdapter,
  TicketSourceAdapterContext,
  TicketSourceAdapterResult
} from "@/lib/ingestion/adapter-contract";

export class TicketSourceRegistry {
  private readonly adapters = new Map<string, TicketSourceAdapter>();

  register(adapter: TicketSourceAdapter): void {
    if (this.adapters.has(adapter.id)) {
      throw new Error(`Ticket source adapter already registered: ${adapter.id}`);
    }

    this.adapters.set(adapter.id, adapter);
  }

  get(adapterId: string): TicketSourceAdapter | undefined {
    return this.adapters.get(adapterId);
  }

  list(): TicketSourceAdapter[] {
    return [...this.adapters.values()];
  }

  async runAll(context: TicketSourceAdapterContext): Promise<TicketSourceAdapterResult[]> {
    return Promise.all(this.list().map((adapter) => adapter.run(context)));
  }
}

export function createTicketSourceRegistry(adapters: TicketSourceAdapter[] = []): TicketSourceRegistry {
  const registry = new TicketSourceRegistry();

  for (const adapter of adapters) {
    registry.register(adapter);
  }

  return registry;
}
