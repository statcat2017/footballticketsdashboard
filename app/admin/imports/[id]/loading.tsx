export default function AdminImportDetailLoading() {
  return (
    <main style={{ maxWidth: "64rem", margin: "0 auto", padding: "0 1rem 3rem", fontFamily: "system-ui, sans-serif" }}>
      <header style={{ padding: "1.25rem 0", borderBottom: "1px solid #dce3e2", marginBottom: "1.5rem" }}>
        <div style={{ height: "13px", width: "120px", background: "#e8eceb", borderRadius: "4px", marginBottom: "4px" }} />
        <div style={{ height: "1.5rem", width: "200px", background: "#e8eceb", borderRadius: "4px" }} />
      </header>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "0.5rem", marginBottom: "1.5rem" }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} style={{ height: "48px", background: "#f5f6f6", borderRadius: "8px" }} />
        ))}
      </div>
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{ height: "28px", width: "80px", background: "#e8eceb", borderRadius: "999px" }} />
        ))}
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} style={{ height: "120px", background: "#f5f6f6", borderRadius: "8px", marginBottom: "0.75rem" }} />
      ))}
    </main>
  );
}
