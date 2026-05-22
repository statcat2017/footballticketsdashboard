import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import UrlImportForm from "@/app/admin/imports/new/UrlImportForm";

const fetchMock = vi.fn<typeof fetch>();

const mockSeasons = [
  { label: "2024-25", startsOn: "2024-07-01", endsOn: "2025-06-30", isCurrent: false },
  { label: "2025-26", startsOn: "2025-07-01", endsOn: "2026-06-30", isCurrent: true },
];

const mockTable = {
  tableIndex: 0,
  caption: "Fixture List",
  headers: ["Date", "Home", "Away"],
  rowCount: 2,
  sampleCells: [["1 July", "Team A", "Team B"]],
  score: 7,
};

const mockTable2 = {
  tableIndex: 1,
  caption: null,
  headers: ["Date", "Home", "Away"],
  rowCount: 1,
  sampleCells: [["2 July", "Team C", "Team D"]],
  score: 5,
};

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("UrlImportForm", () => {
  it("renders the URL input, season select, and detect button", () => {
    render(<UrlImportForm csrfToken="test-csrf" seasons={mockSeasons} />);

    expect(screen.getByPlaceholderText("https://example.com/fixtures")).toBeInTheDocument();
    expect(screen.getByText("Detect tables →")).toBeInTheDocument();
    expect(screen.getByText("2025-26 (current)")).toBeInTheDocument();
    expect(screen.getByText("Activity log will appear here...")).toBeInTheDocument();
  });

  it("calls the preview URL endpoint on detect click and displays tables", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ tables: [mockTable, mockTable2] }),
    );

    const user = userEvent.setup();
    render(<UrlImportForm csrfToken="test-csrf" seasons={mockSeasons} />);

    await user.type(screen.getByPlaceholderText("https://example.com/fixtures"), "https://www.footballwebpages.co.uk/non-league-friendlies");
    await user.click(screen.getByText("Detect tables →"));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/admin/imports/preview-url", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: expect.stringContaining("url=https%3A%2F%2Fwww.footballwebpages.co.uk%2Fnon-league-friendlies"),
      });
    });

    await waitFor(() => {
      expect(screen.getByText("Table 1: Fixture List")).toBeInTheDocument();
    });
    expect(screen.getByText("Table 2")).toBeInTheDocument();
  });

  it("shows an error when detection fails with HTTP error", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Host not found" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const user = userEvent.setup();
    render(<UrlImportForm csrfToken="test-csrf" seasons={mockSeasons} />);

    await user.type(screen.getByPlaceholderText("https://example.com/fixtures"), "https://invalid.example.com");
    await user.click(screen.getByText("Detect tables →"));

    await waitFor(() => {
      expect(screen.getByText(/Host not found/)).toBeInTheDocument();
    });
  });

  it("clears detected tables when the URL is edited after detection", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ tables: [mockTable] }));

    const user = userEvent.setup();
    render(<UrlImportForm csrfToken="test-csrf" seasons={mockSeasons} />);

    const input = screen.getByPlaceholderText("https://example.com/fixtures");
    await user.type(input, "https://example.com/fixtures/1");
    await user.click(screen.getByText("Detect tables →"));

    await waitFor(() => {
      expect(screen.getByText("Table 1: Fixture List")).toBeInTheDocument();
    });

    await user.clear(input);
    await user.type(input, "https://example.com/fixtures/2");

    await waitFor(() => {
      expect(screen.queryByText("Table 1: Fixture List")).not.toBeInTheDocument();
    });
  });

  it("submits the detected URL in the hidden field", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ tables: [mockTable] }));

    const user = userEvent.setup();
    const { container } = render(<UrlImportForm csrfToken="test-csrf" seasons={mockSeasons} />);

    const input = screen.getByPlaceholderText("https://example.com/fixtures");
    await user.type(input, "https://example.com/fixtures/fixtures-page");
    await user.click(screen.getByText("Detect tables →"));

    await waitFor(() => {
      expect(screen.getByText("Table 1: Fixture List")).toBeInTheDocument();
    });

    const hiddenUrl = container.querySelector('input[name="url"]') as HTMLInputElement;
    expect(hiddenUrl?.value).toBe("https://example.com/fixtures/fixtures-page");
  });

  it("clears the hidden form when the URL is edited after detection", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ tables: [mockTable] }));

    const user = userEvent.setup();
    const { container } = render(<UrlImportForm csrfToken="test-csrf" seasons={mockSeasons} />);

    const input = screen.getByPlaceholderText("https://example.com/fixtures");
    await user.type(input, "https://example.com/fixtures/original");
    await user.click(screen.getByText("Detect tables →"));

    await waitFor(() => {
      expect(screen.getByText("Table 1: Fixture List")).toBeInTheDocument();
    });

    await user.clear(input);
    await user.type(input, "https://example.com/fixtures/edited");

    expect(container.querySelector('input[name="url"]')).toBeNull();
  });

  it("shows the selected count in the import button", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ tables: [mockTable, mockTable2] }));

    const user = userEvent.setup();
    render(<UrlImportForm csrfToken="test-csrf" seasons={mockSeasons} />);

    await user.type(screen.getByPlaceholderText("https://example.com/fixtures"), "https://example.com/fixtures");
    await user.click(screen.getByText("Detect tables →"));

    await waitFor(() => {
      expect(screen.getByText(/Import selected \(2\)/)).toBeInTheDocument();
    });

    await user.click(screen.getByText("Deselect all"));

    await waitFor(() => {
      expect(screen.getByText(/Import selected \(0\)/)).toBeInTheDocument();
    });

    await user.click(screen.getByText("Select all"));

    await waitFor(() => {
      expect(screen.getByText(/Import selected \(2\)/)).toBeInTheDocument();
    });
  });

  it("submits the selected season label in the hidden field", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ tables: [mockTable] }));

    const user = userEvent.setup();
    const { container } = render(<UrlImportForm csrfToken="test-csrf" seasons={mockSeasons} />);

    await user.type(screen.getByPlaceholderText("https://example.com/fixtures"), "https://example.com/fixtures");

    const seasonSelect = screen.getByRole("combobox");
    await user.selectOptions(seasonSelect, "2024-25");

    await user.click(screen.getByText("Detect tables →"));

    await waitFor(() => {
      expect(screen.getByText("Table 1: Fixture List")).toBeInTheDocument();
    });

    const hiddenSeason = container.querySelector('input[name="season_label"]') as HTMLInputElement;
    expect(hiddenSeason?.value).toBe("2024-25");
  });

  it("disables the detect button while detecting", async () => {
    fetchMock.mockImplementationOnce(() => new Promise<Response>(() => {}));

    const user = userEvent.setup();
    render(<UrlImportForm csrfToken="test-csrf" seasons={mockSeasons} />);

    await user.type(screen.getByPlaceholderText("https://example.com/fixtures"), "https://example.com/fixtures");
    await user.click(screen.getByText("Detect tables →"));

    await waitFor(() => {
      expect(screen.getByText("Detecting...")).toBeInTheDocument();
    });
  });
});
