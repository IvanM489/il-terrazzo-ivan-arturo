"use client";

import { useEffect, useMemo, useState } from "react";

const mesi = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
const giorniSettimana = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const ICONS = { innaffiata: "💧", potata: "✂️", concimata: "🌿" };

function dateKey(value) {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDate(value) {
  return new Date(value).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function isoDate(value) {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function Calendario() {
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [actions, setActions] = useState([]);
  const [watering, setWatering] = useState([]);
  const [wateringPlants, setWateringPlants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hovered, setHovered] = useState(null);
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editDate, setEditDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 1);

  async function migrateLegacyActions() {
    try {
      const saved = localStorage.getItem("plantActions");
      if (!saved || localStorage.getItem("plantActionsMigratedToDb_v1")) return;
      const legacyActions = JSON.parse(saved);
      if (!Array.isArray(legacyActions) || !legacyActions.length) {
        localStorage.setItem("plantActionsMigratedToDb_v1", "1");
        return;
      }
      const response = await fetch("/api/plant-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ legacyActions }),
      });
      if (response.ok) localStorage.setItem("plantActionsMigratedToDb_v1", "1");
    } catch (err) {
      console.error("Migrazione azioni locali fallita:", err);
    }
  }

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      await migrateLegacyActions();
      const from = monthStart.toISOString();
      const to = monthEnd.toISOString();
      const [actionsResponse, wateringResponse] = await Promise.all([
        fetch(`/api/plant-actions?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { cache: "no-store" }),
        fetch("/api/plant-watering", { cache: "no-store" }),
      ]);
      const actionsResult = await actionsResponse.json();
      const wateringResult = await wateringResponse.json();
      if (!actionsResponse.ok) throw new Error(actionsResult.error || "Errore nel caricamento delle attività.");
      if (!wateringResponse.ok || !wateringResult.success) throw new Error(wateringResult.error || "Errore nel caricamento delle irrigazioni.");
      setActions(actionsResult || []);
      setWatering(wateringResult.records || []);
      setWateringPlants(wateringResult.plants || []);
    } catch (err) {
      console.error(err);
      setError(err.message || "Errore nel caricamento del calendario.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, [year, month]);

  const wateringWithNames = useMemo(() => {
    const map = new Map(wateringPlants.map((p) => [`${p.plantType}:${p.id}`, p.name]));
    return watering.map((record) => ({
      id: record.id,
      type: "innaffiata",
      plant_id: record.plant_id,
      plant_type: record.plant_type,
      performed_at: record.watered_at,
      plant_name: map.get(`${record.plant_type}:${record.plant_id}`) || "Pianta",
      readOnly: true,
    }));
  }, [watering, wateringPlants]);

  const allEvents = useMemo(() => [
    ...wateringWithNames.filter((e) => new Date(e.performed_at) >= monthStart && new Date(e.performed_at) < monthEnd),
    ...actions.map((e) => ({ ...e, readOnly: false })),
  ], [wateringWithNames, actions, monthStart, monthEnd]);

  const byDay = useMemo(() => {
    const map = {};
    allEvents.forEach((event) => {
      const key = dateKey(event.performed_at);
      if (!map[key]) map[key] = [];
      map[key].push(event);
    });
    return map;
  }, [allEvents]);

  const cells = [];
  const firstDay = monthStart.getDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1;
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let day = 1; day <= new Date(year, month + 1, 0).getDate(); day++) cells.push(day);

  function grouped(day) {
    const events = byDay[`${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`] || [];
    return ["innaffiata", "potata", "concimata"].map((type) => ({
      type,
      events: events.filter((e) => e.type === type),
    })).filter((g) => g.events.length);
  }

  function openGroup(type, events, day) {
    setSelected({ type, day, events });
    setSelectedIds([]);
    setEditing(null);
  }

  function startEdit(event) {
    setEditing(event);
    setEditDate(isoDate(event.performed_at));
    setSelectedIds([]);
  }

  async function saveEdit() {
    if (!editing || !editDate) return;
    setSaving(true);
    try {
      const response = await fetch("/api/plant-actions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editing.id, performedAt: `${editDate}T12:00:00` }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Errore nella modifica.");
      setEditing(null);
      await loadData();
      if (selected) setSelected(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteSelected(ids) {
    if (!ids.length || !window.confirm(`Eliminare ${ids.length === 1 ? "questa attività" : `queste ${ids.length} attività`}?`)) return;
    setSaving(true);
    try {
      const response = await fetch("/api/plant-actions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Errore nell'eliminazione.");
      setSelectedIds([]);
      await loadData();
      setSelected(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const todayKey = dateKey(new Date());

  return (
    <main style={{ maxWidth: "1100px", margin: "0 auto", padding: "40px 24px", fontFamily: "Georgia, serif" }}>
      <a href="/" style={{ color: "#55745b", textDecoration: "none", fontWeight: "600" }}>← Torna alla Home</a>
      <h1 style={{ fontSize: "42px", color: "#354d3b", marginTop: "30px", marginBottom: "8px" }}>📅 Calendario</h1>
      <p style={{ color: "#6b756d", fontSize: "18px", marginBottom: "18px" }}>Le cure e le attività del nostro terrazzo.</p>
      <div style={{ display: "flex", gap: "18px", alignItems: "center", flexWrap: "wrap", marginBottom: "24px", color: "#68736b", fontFamily: "Arial, sans-serif", fontSize: "14px" }}>
        <span>💧 Irrigazioni: piante da interno + bonsai</span><span>✂️ Potature</span><span>🌿 Concimazioni</span>
      </div>
      {error && <div style={{ padding: "12px 15px", borderRadius: "12px", background: "#fff0ed", color: "#b42318", marginBottom: "18px" }}>⚠️ {error}</div>}
      <section style={{ background: "#f5f8f1", border: "1px solid #dfe8d8", borderRadius: "24px", padding: "28px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
          <button onClick={() => setCalendarMonth(new Date(year, month - 1, 1))} style={navButton}>←</button>
          <h2 style={{ textAlign: "center", color: "#354d3b", margin: 0 }}>{mesi[month]} {year}</h2>
          <button onClick={() => setCalendarMonth(new Date(year, month + 1, 1))} style={navButton}>→</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: "8px" }}>
          {giorniSettimana.map((g) => <div key={g} style={{ textAlign: "center", fontWeight: "700", color: "#55745b", padding: "8px 2px" }}>{g}</div>)}
          {cells.map((day, index) => {
            const groups = day ? grouped(day) : [];
            const key = day ? `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}` : "";
            return <div key={index} style={{ minHeight: "100px", background: key === todayKey ? "#e2efd9" : "#fff", border: "1px solid #dfe8d8", borderRadius: "12px", padding: "8px", color: "#354d3b", position: "relative" }}>
              {day && <>
                <div style={{ marginBottom: "8px", fontWeight: key === todayKey ? "800" : "600" }}>{day}</div>
                {groups.map((group) => <div key={group.type} style={{ position: "relative", display: "inline-block", marginRight: "8px", marginBottom: "5px" }} onMouseEnter={() => setHovered(`${key}:${group.type}`)} onMouseLeave={() => setHovered(null)}>
                  <button onClick={() => openGroup(group.type, group.events, day)} aria-label={`Visualizza ${group.type}`} style={iconButton}>{ICONS[group.type]}{group.events.length > 1 && <small style={{ fontSize: "10px", marginLeft: "2px" }}>{group.events.length}</small>}</button>
                  {hovered === `${key}:${group.type}` && <div style={tooltip}>{group.events.map((event) => <div key={event.id}>{event.plant_name}</div>)}</div>}
                </div>)}
              </>}
            </div>;
          })}
        </div>
        {loading && <p style={{ textAlign: "center", color: "#68736b", marginBottom: 0 }}>Caricamento attività...</p>}
      </section>

      {selected && <div style={overlay} onClick={() => setSelected(null)}>
        <div style={modal} onClick={(e) => e.stopPropagation()}>
          <button onClick={() => setSelected(null)} style={closeButton}>×</button>
          <h2 style={{ marginTop: 0, color: "#354d3b" }}>{ICONS[selected.type]} {selected.type === "potata" ? "Potature" : selected.type === "concimata" ? "Concimazioni" : "Irrigazioni"}</h2>
          <p style={{ color: "#68736b" }}>{selected.day} {mesi[month].toLowerCase()} {year}</p>
          <div style={{ display: "grid", gap: "8px", marginTop: "16px" }}>
            {selected.events.map((event) => <div key={event.id} style={rowStyle}>
              {selected.type !== "innaffiata" && <input type="checkbox" checked={selectedIds.includes(event.id)} onChange={(e) => setSelectedIds((ids) => e.target.checked ? [...ids, event.id] : ids.filter((id) => id !== event.id))} />}
              <span style={{ flex: 1 }}>{event.plant_name}</span>
              {selected.type !== "innaffiata" && <button onClick={() => startEdit(event)} style={miniButton}>✏️</button>}
              {selected.type !== "innaffiata" && <button onClick={() => deleteSelected([event.id])} style={miniDelete}>🗑️</button>}
            </div>)}
          </div>
          {selected.type !== "innaffiata" && selectedIds.length > 0 && <button onClick={() => deleteSelected(selectedIds)} disabled={saving} style={{ ...primaryButton, background: "#b42318", marginTop: "16px" }}>🗑️ Elimina selezionate ({selectedIds.length})</button>}
        </div>
      </div>}

      {editing && <div style={overlay} onClick={() => setEditing(null)}>
        <div style={modal} onClick={(e) => e.stopPropagation()}>
          <h2 style={{ marginTop: 0, color: "#354d3b" }}>{ICONS[editing.type]} Modifica attività</h2>
          <p style={{ marginBottom: "8px" }}><strong>{editing.plant_name}</strong></p>
          <label style={{ display: "block", color: "#68736b", marginBottom: "8px" }}>Data attività</label>
          <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} style={dateInput} />
          <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}><button onClick={saveEdit} disabled={saving} style={primaryButton}>💾 Salva</button><button onClick={() => setEditing(null)} style={{ ...primaryButton, background: "#777" }}>Annulla</button></div>
        </div>
      </div>}
    </main>
  );
}

const navButton = { border: "1px solid #dfe8d8", background: "#fff", borderRadius: "10px", padding: "8px 14px", cursor: "pointer", fontSize: "18px", color: "#354d3b" };
const iconButton = { border: "none", background: "transparent", cursor: "pointer", fontSize: "22px", padding: "2px", display: "inline-flex", alignItems: "center" };
const tooltip = { position: "absolute", zIndex: 20, left: "50%", bottom: "calc(100% + 8px)", transform: "translateX(-50%)", minWidth: "150px", padding: "9px 11px", borderRadius: "10px", background: "#354d3b", color: "#fff", fontFamily: "Arial, sans-serif", fontSize: "12px", lineHeight: 1.5, boxShadow: "0 6px 18px rgba(0,0,0,.18)" };
const overlay = { position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,.35)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" };
const modal = { width: "100%", maxWidth: "480px", maxHeight: "80vh", overflowY: "auto", background: "#fff", borderRadius: "22px", padding: "25px", boxSizing: "border-box", position: "relative", fontFamily: "Arial, sans-serif" };
const closeButton = { position: "absolute", right: "15px", top: "12px", border: "none", background: "transparent", fontSize: "28px", cursor: "pointer", color: "#777" };
const rowStyle = { display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", borderRadius: "12px", background: "#f5f8f1" };
const miniButton = { border: "none", background: "transparent", cursor: "pointer", fontSize: "16px" };
const miniDelete = { border: "none", background: "transparent", cursor: "pointer", fontSize: "16px" };
const primaryButton = { border: "none", borderRadius: "12px", padding: "10px 15px", background: "#55745b", color: "white", cursor: "pointer", fontWeight: "700" };
const dateInput = { width: "100%", boxSizing: "border-box", padding: "11px", borderRadius: "10px", border: "1px solid #dfe8d8", fontSize: "16px" };
