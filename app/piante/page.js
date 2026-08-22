"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function PlantsPage() {
  const [plants, setPlants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadPlants() {
      try {
        const response = await fetch("/api/home/plants");
        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.error ||
              "Errore nel caricamento delle piante."
          );
        }

        setPlants(result.plants || []);
      } catch (error) {
        console.error(
          "Errore caricamento piante:",
          error
        );

        setError(
          error.message ||
            "Errore nel caricamento delle piante."
        );
      } finally {
        setLoading(false);
      }
    }

    loadPlants();
  }, []);

  const sortedPlants = [...plants].sort((a, b) =>
    (a.name || "").localeCompare(
      b.name || "",
      "it"
    )
  );

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f4f6f1",
        padding: "32px 20px 60px",
        fontFamily:
          "Arial, Helvetica, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
        }}
      >
        <Link
          href="/"
          style={{
            textDecoration: "none",
            color: "#55745b",
            fontWeight: "600",
          }}
        >
          ← Torna alla Home
        </Link>

        <h1
          style={{
            color: "#354d3b",
            fontSize: "38px",
            marginBottom: "8px",
          }}
        >
          🌿 Le mie piante
        </h1>

        <p
          style={{
            color: "#687168",
            marginTop: 0,
          }}
        >
          Le piante del nostro terrazzo e le loro
          esigenze.
        </p>

        {loading && (
          <div
            style={{
              marginTop: "28px",
              padding: "30px",
              textAlign: "center",
              borderRadius: "20px",
              background: "#fffdf8",
              border:
                "1px solid #e8dfcf",
              color: "#687168",
            }}
          >
            🌱 Caricamento delle piante...
          </div>
        )}

        {error && (
          <div
            style={{
              marginTop: "28px",
              padding: "16px",
              borderRadius: "14px",
              background: "#fff0ed",
              border:
                "1px solid #efd0c8",
              color: "#8b4338",
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {!loading &&
          !error &&
          sortedPlants.length === 0 && (
            <div
              style={{
                marginTop: "28px",
                padding: "30px",
                textAlign: "center",
                borderRadius: "20px",
                background: "#fffdf8",
                border:
                  "1px solid #e8dfcf",
                color: "#687168",
              }}
            >
              Nessuna pianta presente.
            </div>
          )}

        {!loading &&
          !error &&
          sortedPlants.length > 0 && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(280px, 1fr))",
                gap: "20px",
                marginTop: "28px",
              }}
            >
              {sortedPlants.map((plant) => (
                <Link
                  key={`${plant.collection}-${plant.id}`}
                  href={`/pianta/${encodeURIComponent(
                    plant.name
                  )}`}
                  style={{
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <article
                    style={{
                      padding: "24px",
                      borderRadius: "20px",
                      background: "#f5f8f1",
                      border:
                        "1px solid #dfe8d8",
                      height: "100%",
                      boxSizing: "border-box",
                      transition:
                        "transform 0.15s ease",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "40px",
                      }}
                    >
                      {plant.icon || "🌿"}
                    </div>

                    <h2
                      style={{
                        color: "#354d3b",
                        marginBottom: "8px",
                      }}
                    >
                      {plant.name}
                    </h2>

                    {plant.scientific && (
                      <p>
                        <em>
                          {plant.scientific}
                        </em>
                      </p>
                    )}

                    <p>
                      <strong>
                        Categoria:
                      </strong>{" "}
                      {plant.category ||
                        "—"}
                    </p>

                    <p>
                      <strong>
                        Esposizione:
                      </strong>{" "}
                      {plant.exposure ||
                        "—"}
                    </p>

                    <p>
                      <strong>
                        Annaffiatura:
                      </strong>{" "}
                      {plant.water ||
                        "—"}
                    </p>

                    <p
                      style={{
                        marginTop: "16px",
                        color: "#55745b",
                        fontWeight: "700",
                        fontSize: "14px",
                      }}
                    >
                      {plant.collection}
                      {" → "}
                      Apri scheda
                    </p>
                  </article>
                </Link>
              ))}
            </div>
          )}
      </div>
    </main>
  );
}
