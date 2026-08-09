import Link from "next/link";
import { createClient } from "../../lib/supabase/server";

export default async function PianteInternePage() {
  const supabase = await createClient();

  const { data: plants, error } = await supabase
    .from("indoor_plants")
    .select("*")
    .order("name", { ascending: true });

  return (
    <main className="page">
      <div className="container">
        <Link href="/" className="back">
          ← Torna alla home
        </Link>

        <header>
          <span className="eyebrow">COLLEZIONE</span>
          <h1>🪴 Piante da interno</h1>
          <p>Le piante da interno della nostra casa.</p>
        </header>

        {error ? (
          <div className="error">
            ⚠️ Errore nel caricamento delle piante.
          </div>
        ) : plants?.length === 0 ? (
          <div className="empty">
            Nessuna pianta da interno presente.
          </div>
        ) : (
          <div className="grid">
            {plants?.map((plant) => (
              <Link
                key={plant.id}
                href={`/pianta/${encodeURIComponent(plant.name)}`}
                className="card"
              >
                <div className="icon">{plant.icon || "🪴"}</div>

                <div>
                  <h2>{plant.name}</h2>

                  {plant.scientific && (
                    <em>{plant.scientific}</em>
                  )}

                  {plant.exposure && (
                    <p>{plant.exposure}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .page {
          min-height: 100vh;
          background: #f4f6f1;
          padding: 35px 20px 60px;
          font-family: Arial, Helvetica, sans-serif;
        }

        .container {
          max-width: 1100px;
          margin: 0 auto;
        }

        .back {
          color: #55745b;
          text-decoration: none;
          font-weight: 700;
        }

        header {
          margin: 28px 0;
        }

        .eyebrow {
          color: #55745b;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 1.3px;
        }

        h1 {
          color: #354d3b;
          font-size: 38px;
          margin: 8px 0;
        }

        header p {
          color: #687168;
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 18px;
        }

        .card {
          display: flex;
          gap: 18px;
          align-items: flex-start;
          padding: 22px;
          background: #fffdf8;
          border: 1px solid #e8dfcf;
          border-radius: 22px;
          text-decoration: none;
          box-shadow: 0 8px 24px rgba(50, 70, 50, .06);
          transition: transform .15s ease;
        }

        .card:hover {
          transform: translateY(-2px);
        }

        .icon {
          font-size: 45px;
          min-width: 55px;
          text-align: center;
        }

        h2 {
          margin: 0 0 4px;
          color: #354d3b;
        }

        em {
          color: #687168;
          font-size: 13px;
        }

        p {
          color: #687168;
          line-height: 1.5;
        }

        .empty,
        .error {
          padding: 30px;
          border-radius: 20px;
          background: #fffdf8;
          text-align: center;
        }

        .error {
          color: #b42318;
        }

        @media (max-width: 700px) {
          .grid {
            grid-template-columns: 1fr;
          }

          h1 {
            font-size: 30px;
          }
        }
      `}</style>
    </main>
  );
}
