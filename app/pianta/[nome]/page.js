"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { plants } from "../../../data/plants";

export default function PlantPage() {
  const params = useParams();
  const nome = decodeURIComponent(params.nome);

  const plant = plants.find((p) => p.name === nome);

  const [lastActions, setLastActions] = useState({});

  useEffect(() => {
    const saved = localStorage.getItem("plantActions");
    if (!saved) return;

    const actions = JSON.parse(saved);

    const plantActions = actions.filter(
      (a) => a.plant === plant.name
    );

    const latest = {};

    plantActions.forEach((action) => {
      latest[action.type] = action.date;
    });

    setLastActions(latest);
  }, [plant.name]);

  if (!plant) {
    return (
      <main style={{ padding: "40px" }}>
        <h1>Pianta non trovata</h1>
        <Link href="/piante">← Torna alle mie piante</Link>
      </main>
    );
  }

  const registraAzione = (tipo) => {
    const oggi = new Date().toISOString();

    const nuovaAzione = {
      date: oggi,
      type: tipo,
      plant: plant.name,
    };

    const saved = localStorage.getItem("plantActions");
    const actions = saved ? JSON.parse(saved) : [];

    actions.push(nuovaAzione);
    localStorage.setItem("plantActions", JSON.stringify(actions));

    setLastActions((prev) => ({
      ...prev,
      [tipo]: oggi,
    }));
  };

  const cardStyle = {
    padding: "22px",
    borderRadius: "20px",
    background: "#f5f8f1",
    border: "1px solid #dfe8d8",
  };

  const buttonStyle = {
    marginTop: "12px",
    padding: "10px 16px",
    border: "none",
    borderRadius: "12px",
    background: "#55745b",
    color: "white",
    cursor: "pointer",
    fontWeight: "600",
  };

  return (
    <main style={{
      maxWidth: "1000px",
      margin: "0 auto",
      padding: "35px 20px"
    }}>

      <Link
        href="/piante"
        style={{
          textDecoration: "none",
          color: "#55745b",
          fontWeight: "600"
        }}
      >
        ← Torna alle mie piante
      </Link>

      <section style={{
        marginTop: "25px",
        padding: "35px",
        borderRadius: "28px",
        background: "#f5f8f1",
        border: "1px solid #dfe8d8"
      }}>
        <div style={{ fontSize: "64px" }}>{plant.icon}</div>
        <h1>{plant.name}</h1>
        <p><em>{plant.scientific}</em></p>
        <p><strong>Categoria:</strong> {plant.category}</p>
      </section>

      <section style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
        gap: "18px",
        marginTop: "25px"
      }}>

        <div style={cardStyle}>
          <h2>☀️ Esposizione</h2>
          <p>{plant.exposure}</p>
        </div>

        <div style={cardStyle}>
          <h2>💧 Irrigazione</h2>
          <p>{plant.water}</p>
        </div>

        <div style={cardStyle}>
          <h2>🌿 Concimazione</h2>
          <p>{plant.fertilizer}</p>

          <button
            onClick={() => registraAzione("concimata")}
            style={buttonStyle}
          >
            🌿 Concimata oggi
          </button>

          {lastActions.concimata && (
            <p style={{ fontSize: "14px", color: "#55745b", display: "flex", alignItems: "center", gap: "8px" }}>
              Ultima concimazione: oggi
              <button
                onClick={() => {
                  const saved = localStorage.getItem("plantActions");
                  const actions = saved ? JSON.parse(saved) : [];
                  const index = [...actions].reverse().findIndex(
                    (a) => a.plant === plant.name && a.type === "concimata"
                  );
                  if (index !== -1) {
                    actions.splice(actions.length - 1 - index, 1);
                    localStorage.setItem("plantActions", JSON.stringify(actions));
                  }
                  setLastActions((prev) => ({ ...prev, concimata: null }));
                }}
                style={{ border: "none", background: "transparent", color: "#c62828", cursor: "pointer", fontSize: "18px", fontWeight: "700", padding: "0" }}
                title="Cancella ultima concimazione"
              >
                ✕
              </button>
            </p>
          )}
        </div>

        <div style={cardStyle}>
          <h2>✂️ Potatura</h2>
          <p>{plant.pruning}</p>

          <button
            onClick={() => registraAzione("potata")}
            style={buttonStyle}
          >
            ✂️ Potata oggi
          </button>

          {lastActions.potata && (
            <p style={{ fontSize: "14px", color: "#55745b", display: "flex", alignItems: "center", gap: "8px" }}>
              Ultima potatura: oggi
              <button
                onClick={() => {
                  const saved = localStorage.getItem("plantActions");
                  const actions = saved ? JSON.parse(saved) : [];
                  const index = [...actions].reverse().findIndex(
                    (a) => a.plant === plant.name && a.type === "potata"
                  );
                  if (index !== -1) {
                    actions.splice(actions.length - 1 - index, 1);
                    localStorage.setItem("plantActions", JSON.stringify(actions));
                  }
                  setLastActions((prev) => ({ ...prev, potata: null }));
                }}
                style={{ border: "none", background: "transparent", color: "#c62828", cursor: "pointer", fontSize: "18px", fontWeight: "700", padding: "0" }}
                title="Cancella ultima potatura"
              >
                ✕
              </button>
            </p>
          )}
        </div>

        <div style={cardStyle}>
          <h2>🐛 Problemi e malattie</h2>
          <p>{plant.problems}</p>
        </div>

        <div style={cardStyle}>
          <h2>📸 Fotografie</h2>
          <p>Ancora nessuna fotografia.</p>
        </div>

      </section>

      <section style={{
        marginTop: "25px",
        padding: "25px",
        borderRadius: "24px",
        background: "#fffaf2",
        border: "1px solid #eadfca"
      }}>
        <h2>📝 Diario della pianta</h2>
        <p>
          Qui registreremo annaffiature, concimazioni,
          potature, problemi e progressi della pianta.
        </p>
      </section>

    </main>
  );
}
