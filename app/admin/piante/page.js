"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const emptyPlant = {
  name: "",
  scientific: "",
  icon: "🌿",
  category: "Sempreverde",
  exposure: "",
  water: "",
  fertilizer: "",
  pruning: "",
  problems: "",
  pruning_season: [],
  fertilizer_season: [],
};

const seasons = [
  "fine inverno",
  "primavera",
  "estate",
  "autunno",
  "inverno",
];

export default function AdminPiantePage() {
  const [plants, setPlants] = useState([]);
  const [form, setForm] = useState(emptyPlant);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState("");
  const [aiFileInputKey, setAiFileInputKey] = useState(0);

  async function loadPlants() {
    setLoading(true);
    setError("");

    const response = await fetch("/api/admin/plants");
    const result = await response.json();

    if (!response.ok) {
      setError(result.error || "Errore nel caricamento.");
      setLoading(false);
      return;
    }

    setPlants(result);
    setLoading(false);
  }

  useEffect(() => {
    loadPlants();
  }, []);

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function toggleSeason(field, season) {
    setForm((current) => {
      const values = current[field] || [];

      return {
        ...current,
        [field]: values.includes(season)
          ? values.filter((item) => item !== season)
          : [...values, season],
      };
    });
  }

  function editPlant(plant) {
    setEditingId(plant.id);

    setForm({
      name: plant.name || "",
      scientific: plant.scientific || "",
      icon: plant.icon || "🌿",
      category: plant.category || "Sempreverde",
      exposure: plant.exposure || "",
      water: plant.water || "",
      fertilizer: plant.fertilizer || "",
      pruning: plant.pruning || "",
      problems: plant.problems || "",
      pruning_season: plant.pruning_season || [],
      fertilizer_season: plant.fertilizer_season || [],
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm({ ...emptyPlant });
    setError("");
  }

  async function fillPlantWithAI(file) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Seleziona una fotografia valida.");
      return;
    }

    setAiLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("image", file);

      const response = await fetch(
        "/api/admin/ai-plant",
        {
          method: "POST",
          body: formData,
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Errore durante il riconoscimento."
        );
      }

      if (!result.plant) {
        throw new Error(
          "L'AI non ha restituito una scheda valida."
        );
      }

      setForm((current) => ({
        ...current,
        ...result.plant,
      }));

    } catch (error) {
      console.error(
        "Errore compilazione AI:",
        error
      );

      setError(
        error.message ||
          "Errore durante il riconoscimento della pianta."
      );
    } finally {
      setAiLoading(false);
      setAiFileInputKey((key) => key + 1);
    }
  }

  function handleAIFile(event) {
    const file = event.target.files?.[0];

    if (file) {
      fillPlantWithAI(file);
    }

    event.target.value = "";
  }

  async function savePlant(event) {
    event.preventDefault();

    setSaving(true);
    setError("");

    const response = await fetch("/api/admin/plants", {
      method: editingId ? "PUT" : "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...form,
        id: editingId,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setError(
        result.error || "Errore durante il salvataggio."
      );
      setSaving(false);
      return;
    }

    resetForm();
    await loadPlants();
    setSaving(false);
  }

  async function deletePlant(id, name) {
    const confirmed = window.confirm(
      `Vuoi davvero eliminare "${name}"?`
    );

    if (!confirmed) return;

    setError("");

    const response = await fetch("/api/admin/plants", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id }),
    });

    const result = await response.json();

    if (!response.ok) {
      setError(
        result.error || "Errore durante l'eliminazione."
      );
      return;
    }

    await loadPlants();
  }

  return (
    <main className="page">
      <div className="container">
        <Link href="/admin" className="back">
          ← Torna all'amministrazione
        </Link>

        <header className="header">
          <span className="eyebrow">AMMINISTRAZIONE</span>

          <h1>🌿 Gestione piante</h1>

          <p>
            Aggiungi, modifica ed elimina le piante
            del terrazzo.
          </p>
        </header>

        {error && (
          <div className="error">
            ⚠️ {error}
          </div>
        )}

        <section className="editor">
          <div className="editorHeader">
            <div>
              <span className="eyebrow">
                {editingId ? "MODIFICA" : "NUOVA PIANTA"}
              </span>

              <h2>
                {editingId
                  ? "Modifica pianta"
                  : "Aggiungi una pianta"}
              </h2>
            </div>

            <div className="editorHeaderActions">
              {!editingId && (
                <>
                  <button
                    type="button"
                    className="aiButton"
                    onClick={() =>
                      document
                        .getElementById("aiPlantPhoto")
                        ?.click()
                    }
                    disabled={aiLoading}
                  >
                    {aiLoading
                      ? "🤖 Analisi in corso..."
                      : "📷 Compila con AI"}
                  </button>

                  <input
                    key={aiFileInputKey}
                    id="aiPlantPhoto"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleAIFile}
                    hidden
                  />
                </>
              )}

              {editingId && (
                <button
                  type="button"
                  className="secondary"
                  onClick={resetForm}
                >
                  Annulla modifica
                </button>
              )}
            </div>
          </div>

          {!editingId && (
            <div className="aiHint">
              🤖 <strong>Compila con AI:</strong>{" "}
              fotografa la pianta e l'intelligenza artificiale
              compilerà automaticamente i campi. Potrai
              controllare e modificare tutto prima di salvare.
            </div>
          )}

          <form onSubmit={savePlant}>
            <div className="grid">
              <Field
                label="Nome"
                value={form.name}
                onChange={(value) =>
                  updateField("name", value)
                }
                required
              />

              <Field
                label="Nome scientifico"
                value={form.scientific}
                onChange={(value) =>
                  updateField("scientific", value)
                }
              />

              <Field
                label="Icona"
                value={form.icon}
                onChange={(value) =>
                  updateField("icon", value)
                }
              />

              <div className="field">
                <label>Categoria</label>

                <select
                  value={form.category}
                  onChange={(event) =>
                    updateField(
                      "category",
                      event.target.value
                    )
                  }
                >
                  <option>Sempreverde</option>
                  <option>Fiorita</option>
                  <option>Rampicante</option>
                  <option>Albero ornamentale</option>
                  <option>Albero da frutto</option>
                  <option>Arbusto</option>
                  <option>Erbacea</option>
                </select>
              </div>

              <TextArea
                label="Esposizione"
                value={form.exposure}
                onChange={(value) =>
                  updateField("exposure", value)
                }
              />

              <TextArea
                label="Irrigazione"
                value={form.water}
                onChange={(value) =>
                  updateField("water", value)
                }
              />

              <TextArea
                label="Concimazione"
                value={form.fertilizer}
                onChange={(value) =>
                  updateField("fertilizer", value)
                }
              />

              <TextArea
                label="Potatura"
                value={form.pruning}
                onChange={(value) =>
                  updateField("pruning", value)
                }
              />

              <TextArea
                label="Problemi comuni"
                value={form.problems}
                onChange={(value) =>
                  updateField("problems", value)
                }
              />
            </div>

            <div className="seasonSections">
              <SeasonSelector
                title="Stagione potatura"
                values={form.pruning_season}
                onToggle={(season) =>
                  toggleSeason(
                    "pruning_season",
                    season
                  )
                }
              />

              <SeasonSelector
                title="Stagione concimazione"
                values={form.fertilizer_season}
                onToggle={(season) =>
                  toggleSeason(
                    "fertilizer_season",
                    season
                  )
                }
              />
            </div>

            <button
              className="primary"
              type="submit"
              disabled={saving}
            >
              {saving
                ? "Salvataggio..."
                : editingId
                  ? "💾 Salva modifiche"
                  : "➕ Aggiungi pianta"}
            </button>
          </form>
        </section>

        <section className="list">
          <div className="listHeader">
            <div>
              <span className="eyebrow">DATABASE</span>
              <h2>Piante presenti</h2>
            </div>

            <span className="count">
              {plants.length}
            </span>
          </div>

          {loading ? (
            <div className="empty">
              Caricamento...
            </div>
          ) : plants.length === 0 ? (
            <div className="empty">
              Nessuna pianta presente.
            </div>
          ) : (
            <div className="plantList">
              {plants.map((plant) => (
                <article
                  className="plant"
                  key={plant.id}
                >
                  <div className="plantIcon">
                    {plant.icon || "🌿"}
                  </div>

                  <div className="plantInfo">
                    <h3>{plant.name}</h3>

                    {plant.scientific && (
                      <em>{plant.scientific}</em>
                    )}

                    <span>
                      {plant.category}
                    </span>
                  </div>

                  <div className="actions">
                    <button
                      className="edit"
                      onClick={() =>
                        editPlant(plant)
                      }
                    >
                      ✏️ Modifica
                    </button>

                    <button
                      className="delete"
                      onClick={() =>
                        deletePlant(
                          plant.id,
                          plant.name
                        )
                      }
                    >
                      🗑️ Elimina
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <style jsx>{`
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

        .header {
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

        h2 {
          color: #354d3b;
          margin: 6px 0;
        }

        .header p {
          color: #687168;
        }

        .error {
          background: #fff0ed;
          color: #b42318;
          border: 1px solid #f0c8c0;
          padding: 14px 16px;
          border-radius: 14px;
          margin-bottom: 20px;
        }

        .editor,
        .list {
          background: #fffdf8;
          border: 1px solid #e8dfcf;
          border-radius: 24px;
          padding: 25px;
          margin-bottom: 24px;
          box-shadow: 0 8px 24px rgba(50, 70, 50, 0.06);
        }

        .editorHeader,
        .listHeader {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          margin-bottom: 22px;
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .field label {
          color: #354d3b;
          font-size: 14px;
          font-weight: 700;
        }

        input,
        textarea,
        select {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #d8d0c0;
          border-radius: 12px;
          padding: 11px 12px;
          background: white;
          color: #263126;
          font: inherit;
        }

        textarea {
          min-height: 105px;
          resize: vertical;
        }

        .seasonSections {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 18px;
          margin: 22px 0;
        }

        .seasonBox {
          padding: 17px;
          border-radius: 16px;
          background: #f4f6f1;
        }

        .seasonBox h3 {
          margin: 0 0 12px;
          color: #354d3b;
          font-size: 15px;
        }

        .seasons {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .seasonButton {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          min-width: 105px;
          border: 2px solid #c7d0c4;
          background: #ffffff;
          color: #354d3b;
          border-radius: 12px;
          padding: 11px 14px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          transition: all 0.15s ease;
        }

        .seasonButton:hover {
          border-color: #55745b;
          background: #f1f6ef;
        }

        .seasonButton.selected {
          background: #55745b;
          border: 3px solid #354d3b;
          color: #ffffff;
          font-weight: 800;
          box-shadow: 0 4px 10px rgba(53, 77, 59, 0.28);
        }

        .seasonCheck {
          width: 18px;
          font-size: 17px;
          font-weight: 900;
          line-height: 1;
        }

        .primary {
          border: none;
          background: #55745b;
          color: white;
          border-radius: 12px;
          padding: 13px 18px;
          font-weight: 700;
          cursor: pointer;
        }

        .primary:disabled {
          opacity: 0.6;
          cursor: default;
        }

        .editorHeaderActions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .aiButton {
          border: 1px solid #c7d9c0;
          background: #e9f1e5;
          color: #354d3b;
          border-radius: 12px;
          padding: 11px 15px;
          cursor: pointer;
          font-weight: 800;
        }

        .aiButton:hover {
          background: #dfeadb;
        }

        .aiButton:disabled {
          opacity: 0.6;
          cursor: wait;
        }

        .aiHint {
          margin-bottom: 20px;
          padding: 14px 16px;
          border-radius: 14px;
          background: #f1f6ef;
          border: 1px solid #d8e6d2;
          color: #55745b;
          line-height: 1.5;
          font-size: 13px;
        }

        .secondary {
          border: 1px solid #d8d0c0;
          background: white;
          color: #55745b;
          border-radius: 12px;
          padding: 10px 14px;
          cursor: pointer;
          font-weight: 700;
        }

        .count {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: #e9f1e5;
          color: #55745b;
          font-weight: 800;
        }

        .plantList {
          display: grid;
          gap: 10px;
        }

        .plant {
          display: flex;
          align-items: center;
          gap: 15px;
          padding: 15px;
          border: 1px solid #e8dfcf;
          border-radius: 16px;
          background: #fafbf7;
        }

        .plantIcon {
          font-size: 35px;
          width: 48px;
          text-align: center;
        }

        .plantInfo {
          flex: 1;
          min-width: 0;
        }

        .plantInfo h3 {
          margin: 0 0 3px;
          color: #354d3b;
        }

        .plantInfo em {
          display: block;
          color: #687168;
          font-size: 13px;
          margin-bottom: 4px;
        }

        .plantInfo span {
          color: #7b837c;
          font-size: 12px;
        }

        .actions {
          display: flex;
          gap: 7px;
        }

        .edit,
        .delete {
          border-radius: 10px;
          padding: 9px 11px;
          cursor: pointer;
          font-weight: 700;
          background: white;
        }

        .edit {
          border: 1px solid #d8e0d4;
          color: #55745b;
        }

        .delete {
          border: 1px solid #efd0cb;
          color: #b42318;
        }

        .empty {
          text-align: center;
          padding: 30px;
          color: #687168;
        }

        @media (max-width: 700px) {
          .grid,
          .seasonSections {
            grid-template-columns: 1fr;
          }

          .plant {
            align-items: flex-start;
            flex-wrap: wrap;
          }

          .actions {
            width: 100%;
          }

          .actions button {
            flex: 1;
          }

          h1 {
            font-size: 30px;
          }
        }
      `}</style>
    </main>
  );
}

function Field({ label, value, onChange, required }) {
  return (
    <div className="field">
      <label>{label}</label>

      <input
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        required={required}
      />
    </div>
  );
}

function TextArea({ label, value, onChange }) {
  return (
    <div className="field">
      <label>{label}</label>

      <textarea
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
      />
    </div>
  );
}

function SeasonSelector({
  title,
  values,
  onToggle,
}) {
  const selected = Array.isArray(values)
    ? values
    : normalizeSeasons(values);

  return (
    <div className="seasonBox">
      <h3>{title}</h3>

      <div className="seasons">
        {seasons.map((season) => {
          const active = selected.includes(season);

          return (
            <button
              type="button"
              key={season}
              className={`seasonButton ${
                active ? "selected" : ""
              }`}
              aria-pressed={active}
              onClick={() => onToggle(season)}
            >
              <span className="seasonCheck">
                {active ? "✓" : "○"}
              </span>

              <span>
                {season}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
