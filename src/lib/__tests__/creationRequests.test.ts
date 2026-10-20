import { describe, it, expect } from "vitest";

// ─── Status label / style mappings ───────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  in_progress: "In Progress",
  quote_sent: "Quote Sent",
  accepted: "Accepted",
  completed: "Completed",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

const STATUS_STYLES: Record<string, string> = {
  new:         "bg-amber-50 text-amber-700 border-amber-200",
  in_progress: "bg-blue-50 text-blue-700 border-blue-200",
  quote_sent:  "bg-purple-50 text-purple-700 border-purple-200",
  accepted:    "bg-indigo-50 text-indigo-700 border-indigo-200",
  completed:   "bg-green-50 text-green-700 border-green-200",
  rejected:    "bg-red-50 text-red-500 border-red-200",
  cancelled:   "bg-gray-100 text-gray-500 border-gray-200",
};

describe("STATUS_LABELS", () => {
  it("maps all 7 status values", () => {
    const keys = Object.keys(STATUS_LABELS);
    expect(keys).toHaveLength(7);
  });

  it("maps new → New", () => expect(STATUS_LABELS["new"]).toBe("New"));
  it("maps in_progress → In Progress", () => expect(STATUS_LABELS["in_progress"]).toBe("In Progress"));
  it("maps quote_sent → Quote Sent", () => expect(STATUS_LABELS["quote_sent"]).toBe("Quote Sent"));
  it("maps accepted → Accepted", () => expect(STATUS_LABELS["accepted"]).toBe("Accepted"));
  it("maps completed → Completed", () => expect(STATUS_LABELS["completed"]).toBe("Completed"));
  it("maps rejected → Rejected", () => expect(STATUS_LABELS["rejected"]).toBe("Rejected"));
  it("maps cancelled → Cancelled", () => expect(STATUS_LABELS["cancelled"]).toBe("Cancelled"));

  it("returns undefined for unknown status", () => {
    expect(STATUS_LABELS["unknown"]).toBeUndefined();
  });
});

describe("STATUS_STYLES", () => {
  it("maps all 7 status values", () => {
    expect(Object.keys(STATUS_STYLES)).toHaveLength(7);
  });

  it("new uses amber classes", () => {
    expect(STATUS_STYLES["new"]).toContain("amber");
  });

  it("completed uses green classes", () => {
    expect(STATUS_STYLES["completed"]).toContain("green");
  });

  it("cancelled uses gray classes", () => {
    expect(STATUS_STYLES["cancelled"]).toContain("gray");
  });

  it("rejected uses red classes", () => {
    expect(STATUS_STYLES["rejected"]).toContain("red");
  });
});

// ─── Search filter logic ──────────────────────────────────────────────────────

type Req = { ref_number: string; full_name: string; email: string; status: string };

function filterRequests(requests: Req[], query: string, statusFilter: string): Req[] {
  const q = query.trim().toLowerCase();
  return requests.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (!q) return true;
    return (
      r.ref_number.toLowerCase().includes(q) ||
      r.full_name.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q)
    );
  });
}

const SAMPLE: Req[] = [
  { ref_number: "DEKO-2026-000001", full_name: "Amina Kovač", email: "amina@example.com", status: "new" },
  { ref_number: "DEKO-2026-000002", full_name: "Bojan Marić", email: "bojan@example.ba", status: "in_progress" },
  { ref_number: "DEKO-2026-000003", full_name: "Lejla Hodžić", email: "lejla@test.com", status: "completed" },
  { ref_number: "DEKO-2026-000004", full_name: "Test User", email: "test@example.com", status: "cancelled" },
];

describe("search filter — ref_number match", () => {
  it("finds by exact ref number", () => {
    const result = filterRequests(SAMPLE, "DEKO-2026-000001", "all");
    expect(result).toHaveLength(1);
    expect(result[0].ref_number).toBe("DEKO-2026-000001");
  });

  it("finds by partial ref number", () => {
    const result = filterRequests(SAMPLE, "000002", "all");
    expect(result).toHaveLength(1);
    expect(result[0].ref_number).toBe("DEKO-2026-000002");
  });

  it("is case-insensitive for ref number", () => {
    const result = filterRequests(SAMPLE, "deko-2026-000003", "all");
    expect(result).toHaveLength(1);
  });
});

describe("search filter — full_name match", () => {
  it("finds by full name", () => {
    const result = filterRequests(SAMPLE, "Amina", "all");
    expect(result).toHaveLength(1);
    expect(result[0].full_name).toBe("Amina Kovač");
  });

  it("finds by last name", () => {
    const result = filterRequests(SAMPLE, "Hodžić", "all");
    expect(result).toHaveLength(1);
  });

  it("is case-insensitive for name", () => {
    const result = filterRequests(SAMPLE, "amina", "all");
    expect(result).toHaveLength(1);
  });
});

describe("search filter — email match", () => {
  it("finds by email", () => {
    const result = filterRequests(SAMPLE, "bojan@example.ba", "all");
    expect(result).toHaveLength(1);
    expect(result[0].email).toBe("bojan@example.ba");
  });

  it("finds by partial email domain", () => {
    const result = filterRequests(SAMPLE, "example.com", "all");
    expect(result).toHaveLength(2);
  });

  it("is case-insensitive for email", () => {
    const result = filterRequests(SAMPLE, "LEJLA@TEST.COM", "all");
    expect(result).toHaveLength(1);
  });
});

describe("search filter — no query", () => {
  it("returns all records when query is empty", () => {
    expect(filterRequests(SAMPLE, "", "all")).toHaveLength(4);
  });

  it("returns all records when query is whitespace", () => {
    expect(filterRequests(SAMPLE, "   ", "all")).toHaveLength(4);
  });

  it("returns no records when nothing matches", () => {
    expect(filterRequests(SAMPLE, "xxxxxxxx", "all")).toHaveLength(0);
  });
});

// ─── Status filter logic ──────────────────────────────────────────────────────

describe("status filter", () => {
  it("all — returns all records", () => {
    expect(filterRequests(SAMPLE, "", "all")).toHaveLength(4);
  });

  it("new — returns only new", () => {
    const result = filterRequests(SAMPLE, "", "new");
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("new");
  });

  it("completed — returns only completed", () => {
    const result = filterRequests(SAMPLE, "", "completed");
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("completed");
  });

  it("cancelled — returns only cancelled", () => {
    const result = filterRequests(SAMPLE, "", "cancelled");
    expect(result).toHaveLength(1);
  });

  it("rejected — returns empty when no rejected requests", () => {
    expect(filterRequests(SAMPLE, "", "rejected")).toHaveLength(0);
  });

  it("combined: status + search — returns intersection", () => {
    const result = filterRequests(SAMPLE, "example.com", "new");
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("new");
    expect(result[0].email).toContain("example.com");
  });
});

// ─── Date formatting ──────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

describe("formatDate", () => {
  it("formats ISO date to en-GB short", () => {
    expect(formatDate("2026-01-15T10:30:00Z")).toContain("Jan");
    expect(formatDate("2026-01-15T10:30:00Z")).toContain("2026");
  });

  it("formats December correctly", () => {
    expect(formatDate("2025-12-01T00:00:00Z")).toContain("Dec");
  });

  it("returns a non-empty string for valid ISO", () => {
    expect(formatDate("2026-06-20T08:00:00Z").length).toBeGreaterThan(0);
  });
});
