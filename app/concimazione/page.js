"use client";

import { useEffect, useState } from "react";
import { plants } from "../../data/plants";

export default function Concimazione() {
  const [lastFertilized, setLastFertilized] = useState({});

  useEffect(() => {
    const saved = window.localStorage.getItem("lastFertilized");
    if (saved) {
      setLastFertilized(JSON.parse(saved));
    }
  }, []);

  const concima = (name) => {
    const next = {
      ...lastFertilized,
      [name]: new Date().toISOString(),
    };

    setLastFertilized(next);
    window.localStorage.setItem("lastFertilized", JSON.stringify(next));
  };

  return (
    <main style={{
      maxWidth: "1100px",
      margin: "0 auto",
      padding: "40px 24px",
      fontFamily: "Georgia, serif"
    }}>

      <a
        href="/"
        style={{
          color: "#55745b",
          textDecoration: "none",
          fontWeight: "600"
        }}
      >
        ← Torna alla Home
      </a>

      <h1 style={{
        fontSize: "42px",
        color: "#354d3b",
        marginTop: "30px",
        marginBottom: "8px"
      }}>
        🌱 Concimazione
      </h1>

      <p style={{
        color: "#6b756d",
        fontSize: "18px",
        marginBottom: "30px"
      }}>
        Teniamo sotto controllo nutrimento e concimazione delle nostre piante.
      </p>

      <section style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: "18px"
      }}>

        {plants.map((plant) => (
          <article
            key={plant.name}
            style={{
              background: "#f5f8f1",
              border: "1px solid #dfe8d8",
              borderRadius: "20px",
              padding: "24px"
            }}
          >

            <div style={{ fontSize: "36px" }}>
              {plant.icon}
            </div>

            <h2 style={{ color: "#354d3b" }}>
              {plant.name}
            </h2>

            <p>
              <strong>Concimazione consigliata</strong>
            </p>

            <p style={{ color: "#59645c" }}>
              {plant.fertilizer}
            </p>

            <button
              onClick={() => concima(plant.name)}
              style={{
                marginTop: "12px",
                padding: "10px 16px",
                border: "none",
                borderRadius: "12px",
                background: "#55745b",
                color: "white",
                cursor: "pointer"
              }}
            >
              🌱 Concimata oggi
            </button>

            {lastFertilized[plant.name] && (
              <p style={{
                fontSize: "14px",
                color: "#55745b",
                marginTop: "10px"
              }}>
                Ultima concimazione: oggi
              </p>
            )}

          </article>
        ))}

      </section>
    </main>
  );
}
