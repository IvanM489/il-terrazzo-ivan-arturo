"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { createClient } from "../../../lib/supabase/client";
import { plants as localPlants } from "../../../data/plants";

const TABLES = [
  { table: "plants", type: "plants" },
  { table: "indoor_plants", type: "indoor_plants" },
  { table: "bonsai", type: "bonsai" },
];

export default function PlantPage() {
  const params = useParams();
  const nome = decodeURIComponent(params.nome);

  const localPlant =
    localPlants.find((p) => p.name === nome) || null;

  const [plant, setPlant] = useState(localPlant);
  const [plantId, setPlantId] = useState(null);
  const [plantType, setPlantType] = useState(null);

  const [lastActions, setLastActions] = useState({});

  const [notes, setNotes] = useState([]);
  const [noteText, setNoteText] = useState("");
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editingText, setEditingText] = useState("");

  const [loadingPlant, setLoadingPlant] = useState(true);
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [savingNote, setSavingNote] = useState(false);

  const [noteError, setNoteError] = useState("");

  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState(null);

  /*
   * AUTENTICAZIONE + RICERCA DELLA PIANTA
   *
   * Cerca automaticamente nelle tre tabelle:
   * plants
   * indoor_plants
   * bonsai
   */
  useEffect(() => {
    async function loadPlant() {
      setLoadingPlant(true);

      try {
        const supabase = createClient();

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          window.location.href =
            `/login?redirect=${encodeURIComponent(
              window.location.pathname
            )}`;
          return;
        }

        setUserId(user.id);

        const { data: profile } = await supabase
          .from("profiles")
          .select("ruolo")
          .eq("id", user.id)
          .single();

        setIsAdmin(profile?.ruolo === "admin");

        let found = null;

        for (const source of TABLES) {
          const { data, error } = await supabase
            .from(source.table)
            .select("*")
            .eq("name", nome)
            .maybeSingle();

          if (error) {
            console.error(
              `Errore tabella ${source.table}:`,
              error
            );
            continue;
          }

          if (data) {
            found = {
              ...data,
              plantType: source.type,
            };
            break;
          }
        }

        if (!found) {
          setNoteError(
            `La pianta "${nome}" non è presente nel database.`
          );
          setLoadingPlant(false);
          return;
        }

        /*
         * Per le 5 piante principali manteniamo anche
         * i dati locali già presenti in data/plants.js.
         *
         * Per indoor e bonsai utilizziamo direttamente
         * i dati Supabase.
         */
        const merged =
          localPlant && found.plantType === "plants"
            ? {
                ...localPlant,
                ...found,
              }
            : found;

        setPlant(merged);
        setPlantId(found.id);
        setPlantType(found.plantType);
      } catch (error) {
        setNoteError(error.message);
      } finally {
        setLoadingPlant(false);
      }
    }

    loadPlant();
  }, [nome, localPlant]);

  /*
   * AZIONI LOCALI
   */
  useEffect(() => {
    if (!plant) return;

    const saved =
      localStorage.getItem("plantActions");

    if (!saved) return;

    try {
      const actions = JSON.parse(saved);

      const plantActions = actions.filter(
        (a) => a.plant === plant.name
      );

      const latest = {};

      plantActions.forEach((action) => {
        latest[action.type] = action.date;
      });

      setLastActions(latest);
    } catch {
      localStorage.removeItem("plantActions");
    }
  }, [plant]);

  /*
   * DIARIO
   */
  useEffect(() => {
    if (!plantId || !plantType) return;

    async function loadNotes() {
      setLoadingNotes(true);

      try {
        const response = await fetch(
          `/api/plant-notes?plantId=${encodeURIComponent(
            plantId
          )}&plantType=${encodeURIComponent(
            plantType
          )}`
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.error ||
              "Errore nel caricamento del diario."
          );
        }

        setNotes(result);
      } catch (error) {
        setNoteError(error.message);
      } finally {
        setLoadingNotes(false);
      }
    }

    loadNotes();
  }, [plantId, plantType]);

  if (loadingPlant) {
    return (
      <main
        style={{
          padding: "50px",
          textAlign: "center",
        }}
      >
        Caricamento pianta...
      </main>
    );
  }

  if (!plant || !plantId || !plantType) {
    return (
      <main style={{ padding: "40px" }}>
        <h1>Pianta non trovata</h1>

        {noteError && (
          <p style={{ color: "#b42318" }}>
            {noteError}
          </p>
        )}

        <Link href="/piante">
          ← Torna alle mie piante
        </Link>
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

    const saved =
      localStorage.getItem("plantActions");

    const actions = saved
      ? JSON.parse(saved)
      : [];

    actions.push(nuovaAzione);

    localStorage.setItem(
      "plantActions",
      JSON.stringify(actions)
    );

    setLastActions((prev) => ({
      ...prev,
      [tipo]: oggi,
    }));
  };

  const eliminaUltimaAzione = (tipo) => {
    const saved =
      localStorage.getItem("plantActions");

    const actions = saved
      ? JSON.parse(saved)
      : [];

    const index = [...actions]
      .reverse()
      .findIndex(
        (a) =>
          a.plant === plant.name &&
          a.type === tipo
      );

    if (index !== -1) {
      actions.splice(
        actions.length - 1 - index,
        1
      );

      localStorage.setItem(
        "plantActions",
        JSON.stringify(actions)
      );
    }

    setLastActions((prev) => ({
      ...prev,
      [tipo]: null,
    }));
  };

  async function aggiungiNota(event) {
    event.preventDefault();

    if (!noteText.trim()) return;

    setSavingNote(true);
    setNoteError("");

    try {
      const response = await fetch(
        "/api/plant-notes",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            plantId,
            plantType,
            text: noteText,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Errore nel salvataggio."
        );
      }

      setNotes((prev) => [
        result,
        ...prev,
      ]);

      setNoteText("");
    } catch (error) {
      setNoteError(error.message);
    } finally {
      setSavingNote(false);
    }
  }

  async function salvaModificaNota(id) {
    if (!editingText.trim()) return;

    setNoteError("");

    try {
      const response = await fetch(
        "/api/plant-notes",
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id,
            text: editingText,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Errore nella modifica."
        );
      }

      setNotes((prev) =>
        prev.map((note) =>
          note.id === id
            ? result
            : note
        )
      );

      setEditingNoteId(null);
      setEditingText("");
    } catch (error) {
      setNoteError(error.message);
    }
  }

  async function eliminaNota(id) {
    if (
      !window.confirm(
        "Vuoi davvero eliminare questa nota?"
      )
    ) {
      return;
    }

    setNoteError("");

    try {
      const response = await fetch(
        "/api/plant-notes",
        {
          method: "DELETE",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({ id }),
        }
      );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Errore nell'eliminazione."
        );
      }

      setNotes((prev) =>
        prev.filter(
          (note) => note.id !== id
        )
      );
    } catch (error) {
      setNoteError(error.message);
    }
  }

  function formatDate(date) {
    return new Date(
      date
    ).toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  const cardStyle = {
    padding: "22px",
    borderRadius: "20px",
    background: "#f5f8f1",
    border:
      "1px solid #dfe8d8",
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
    <main
      style={{
        maxWidth: "1000px",
        margin: "0 auto",
        padding: "35px 20px 60px",
      }}
    >
      <Link
        href={
          plantType === "plants"
            ? "/piante"
            : plantType === "indoor_plants"
            ? "/piante-interne"
            : "/bonsai"
        }
        style={{
          textDecoration: "none",
          color: "#55745b",
          fontWeight: "600",
        }}
      >
        ← Torna alla collezione
      </Link>

      <section
        style={{
          marginTop: "25px",
          padding: "35px",
          borderRadius: "28px",
          background: "#f5f8f1",
          border:
            "1px solid #dfe8d8",
        }}
      >
        <div
          style={{
            fontSize: "64px",
          }}
        >
          {plant.icon || "🌿"}
        </div>

        <h1>{plant.name}</h1>

        {plant.scientific && (
          <p>
            <em>
              {plant.scientific}
            </em>
          </p>
        )}

        {plant.category && (
          <p>
            <strong>
              Categoria:
            </strong>{" "}
            {plant.category}
          </p>
        )}
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(250px, 1fr))",
          gap: "18px",
          marginTop: "25px",
        }}
      >
        {plant.exposure && (
          <div style={cardStyle}>
            <h2>
              ☀️ Esposizione
            </h2>
            <p>
              {plant.exposure}
            </p>
          </div>
        )}

        {plant.water && (
          <div style={cardStyle}>
            <h2>
              💧 Irrigazione
            </h2>
            <p>
              {plant.water}
            </p>
          </div>
        )}

        {plant.fertilizer && (
          <div style={cardStyle}>
            <h2>
              🌿 Concimazione
            </h2>

            <p>
              {plant.fertilizer}
            </p>

            <button
              onClick={() =>
                registraAzione(
                  "concimata"
                )
              }
              style={buttonStyle}
            >
              🌿 Concimata oggi
            </button>

            {lastActions.concimata && (
              <p
                style={{
                  fontSize: "14px",
                  color: "#55745b",
                  display: "flex",
                  alignItems:
                    "center",
                  gap: "8px",
                }}
              >
                Ultima concimazione:
                oggi

                <button
                  onClick={() =>
                    eliminaUltimaAzione(
                      "concimata"
                    )
                  }
                  style={{
                    border: "none",
                    background:
                      "transparent",
                    color:
                      "#c62828",
                    cursor:
                      "pointer",
                    fontSize:
                      "18px",
                    fontWeight:
                      "700",
                    padding: "0",
                  }}
                >
                  ✕
                </button>
              </p>
            )}
          </div>
        )}

        {plant.pruning && (
          <div style={cardStyle}>
            <h2>
              ✂️ Potatura
            </h2>

            <p>
              {plant.pruning}
            </p>

            <button
              onClick={() =>
                registraAzione(
                  "potata"
                )
              }
              style={buttonStyle}
            >
              ✂️ Potata oggi
            </button>

            {lastActions.potata && (
              <p
                style={{
                  fontSize: "14px",
                  color: "#55745b",
                  display: "flex",
                  alignItems:
                    "center",
                  gap: "8px",
                }}
              >
                Ultima potatura:
                oggi

                <button
                  onClick={() =>
                    eliminaUltimaAzione(
                      "potata"
                    )
                  }
                  style={{
                    border: "none",
                    background:
                      "transparent",
                    color:
                      "#c62828",
                    cursor:
                      "pointer",
                    fontSize:
                      "18px",
                    fontWeight:
                      "700",
                    padding: "0",
                  }}
                >
                  ✕
                </button>
              </p>
            )}
          </div>
        )}

        {plant.problems && (
          <div style={cardStyle}>
            <h2>
              🐛 Problemi e malattie
            </h2>
            <p>
              {plant.problems}
            </p>
          </div>
        )}

        <div style={cardStyle}>
          <h2>
            📸 Fotografie
          </h2>

          <Link
            href={`/pianta/${encodeURIComponent(
              plant.name
            )}/foto?plantType=${encodeURIComponent(
              plantType
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display:
                "inline-block",
              marginTop: "10px",
              color: "#55745b",
              fontWeight: "700",
              textDecoration:
                "none",
              cursor:
                "pointer",
            }}
          >
            📷 Clicca qui per vedere
            le foto →
          </Link>
        </div>
      </section>

      <section
        style={{
          marginTop: "25px",
          padding: "25px",
          borderRadius: "24px",
          background: "#fffaf2",
          border:
            "1px solid #eadfca",
        }}
      >
        <h2>
          📝 Diario della pianta
        </h2>

        {noteError && (
          <div
            style={{
              marginTop: "15px",
              padding: "12px",
              borderRadius: "12px",
              background:
                "#fff0ed",
              color:
                "#b42318",
            }}
          >
            ⚠️ {noteError}
          </div>
        )}

        <form
          onSubmit={aggiungiNota}
          style={{
            marginTop: "18px",
          }}
        >
          <textarea
            value={noteText}
            onChange={(event) =>
              setNoteText(
                event.target.value
              )
            }
            placeholder="Scrivi una nota sulla pianta..."
            rows={4}
            style={{
              width: "100%",
              boxSizing:
                "border-box",
              padding: "14px",
              borderRadius:
                "14px",
              border:
                "1px solid #d8d0c0",
              resize:
                "vertical",
              fontFamily:
                "Arial, Helvetica, sans-serif",
              fontSize:
                "15px",
            }}
          />

          <button
            type="submit"
            disabled={
              savingNote ||
              !noteText.trim()
            }
            style={{
              ...buttonStyle,
              opacity:
                savingNote ||
                !noteText.trim()
                  ? 0.5
                  : 1,
            }}
          >
            {savingNote
              ? "Salvataggio..."
              : "➕ Aggiungi nota"}
          </button>
        </form>

        <div
          style={{
            marginTop: "25px",
            display: "grid",
            gap: "14px",
          }}
        >
          {loadingNotes ? (
            <p>
              Caricamento diario...
            </p>
          ) : notes.length ===
            0 ? (
            <p
              style={{
                color: "#777",
              }}
            >
              Ancora nessuna nota.
              Scrivi la prima
              osservazione sulla
              tua pianta.
            </p>
          ) : (
            notes.map((note) => {
              const canManage =
                note.user_id ===
                  userId ||
                isAdmin;

              return (
                <article
                  key={note.id}
                  style={{
                    padding: "18px",
                    background:
                      "#fffdf8",
                    border:
                      "1px solid #e8dfcf",
                    borderRadius:
                      "16px",
                  }}
                >
                  <div
                    style={{
                      display:
                        "flex",
                      justifyContent:
                        "space-between",
                      alignItems:
                        "center",
                      gap: "15px",
                    }}
                  >
                    <small
                      style={{
                        color:
                          "#7a827a",
                      }}
                    >
                      📅{" "}
                      {formatDate(
                        note.created_at
                      )}
                      {note.updated_at !==
                        note.created_at &&
                        " · modificata"}
                    </small>

                    {canManage && (
                      <div
                        style={{
                          display:
                            "flex",
                          gap: "8px",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setEditingNoteId(
                              note.id
                            );
                            setEditingText(
                              note.text
                            );
                          }}
                          style={{
                            border:
                              "none",
                            background:
                              "transparent",
                            color:
                              "#55745b",
                            cursor:
                              "pointer",
                            fontWeight:
                              "700",
                          }}
                        >
                          ✏️
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            eliminaNota(
                              note.id
                            )
                          }
                          style={{
                            border:
                              "none",
                            background:
                              "transparent",
                            color:
                              "#c62828",
                            cursor:
                              "pointer",
                            fontWeight:
                              "700",
                          }}
                        >
                          🗑️
                        </button>
                      </div>
                    )}
                  </div>

                  {editingNoteId ===
                  note.id ? (
                    <div
                      style={{
                        marginTop:
                          "12px",
                      }}
                    >
                      <textarea
                        value={
                          editingText
                        }
                        onChange={(
                          event
                        ) =>
                          setEditingText(
                            event.target
                              .value
                          )
                        }
                        rows={4}
                        style={{
                          width:
                            "100%",
                          boxSizing:
                            "border-box",
                          padding:
                            "12px",
                          borderRadius:
                            "12px",
                          border:
                            "1px solid #d8d0c0",
                          resize:
                            "vertical",
                          fontFamily:
                            "Arial, Helvetica, sans-serif",
                        }}
                      />

                      <div
                        style={{
                          display:
                            "flex",
                          gap: "8px",
                          marginTop:
                            "8px",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            salvaModificaNota(
                              note.id
                            )
                          }
                          style={
                            buttonStyle
                          }
                        >
                          💾 Salva
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setEditingNoteId(
                              null
                            );
                            setEditingText(
                              ""
                            );
                          }}
                          style={{
                            ...buttonStyle,
                            background:
                              "#777",
                          }}
                        >
                          Annulla
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p
                      style={{
                        margin:
                          "12px 0 0",
                        lineHeight:
                          1.6,
                        whiteSpace:
                          "pre-wrap",
                      }}
                    >
                      {note.text}
                    </p>
                  )}
                </article>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}
