import Link from "next/link";

export default function AdminPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f4f6f1",
        padding: "40px 24px",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        <Link
          href="/"
          style={{
            color: "#55745b",
            textDecoration: "none",
            fontWeight: "600",
          }}
        >
          ← Torna alla Home
        </Link>

        <header style={{ margin: "30px 0" }}>
          <div
            style={{
              fontSize: "13px",
              fontWeight: "700",
              color: "#55745b",
              letterSpacing: "1px",
            }}
          >
            AMMINISTRAZIONE
          </div>

          <h1
            style={{
              color: "#354d3b",
              fontSize: "40px",
              margin: "8px 0",
            }}
          >
            ⚙️ Pannello amministratore
          </h1>

          <p style={{ color: "#687168", fontSize: "18px" }}>
            Gestisci tutti i contenuti de Il Terrazzo di Ivan & Arturo.
          </p>
        </header>

        <section
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(250px, 1fr))",
            gap: "18px",
          }}
        >
          <AdminCard
            href="/admin/piante"
            icon="🌿"
            title="Gestione piante"
            text="Aggiungi, modifica ed elimina le piante del terrazzo."
          />

          <AdminCard
            href="/admin/piante-interne"
            icon="🪴"
            title="Piante da interno"
            text="Gestisci le piante presenti in casa."
          />

          <AdminCard
            href="/admin/bonsai"
            icon="🌳"
            title="Bonsai"
            text="Gestisci le schede e le cure dei bonsai."
          />

          <AdminCard
            href="/admin/utenti"
            icon="👥"
            title="Gestione utenti"
            text="Aggiungi, modifica ed elimina gli utenti."
          />
        </section>
      </div>
    </main>
  );
}

function AdminCard({ href, icon, title, text }) {
  return (
    <Link
      href={href}
      style={{
        display: "block",
        textDecoration: "none",
        background: "#fffdf8",
        border: "1px solid #e8dfcf",
        borderRadius: "22px",
        padding: "26px",
        color: "#354d3b",
        boxShadow: "0 8px 24px rgba(50,70,50,0.06)",
      }}
    >
      <div style={{ fontSize: "38px" }}>{icon}</div>

      <h2 style={{ margin: "14px 0 6px" }}>
        {title}
      </h2>

      <p
        style={{
          margin: 0,
          color: "#687168",
          lineHeight: 1.5,
        }}
      >
        {text}
      </p>

      <div
        style={{
          marginTop: "18px",
          color: "#55745b",
          fontWeight: "700",
        }}
      >
        Apri →
      </div>
    </Link>
  );
}
