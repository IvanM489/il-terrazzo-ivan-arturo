"use client";

import { useEffect, useMemo, useState } from "react";

const mesi = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
const giorniSettimana = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const TIPI = ["innaffiata", "potata", "concimata"];
const ICONS = { innaffiata: "💧", potata: "✂️", concimata: "🌿" };
const LABELS = { innaffiata: "Irrigazione", potata: "Potatura", concimata: "Concimazione" };

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
      collection: record.plant_type === "bonsai" ? "Bonsai" : "Piante da interno",
      readOnly: false,
      source: "watering",
    }));
  }, [watering, wateringPlants]);

  const allEvents = useMemo(() => [
    ...wateringWithNames.filter((event) => new Date(event.performed_at) >= monthStart && new Date(event.performed_at) < monthEnd),
    ...actions.map((event) => ({ ...event, readOnly: false, source: "action" })),
  ], [wateringWithNames, actions, monthStart, monthEnd]);

  const byDay = useMemo(() => {
    const map = {};
    allEvents.forEach((event) => {
      const key = dateKey(event.performed_at);
      if (!map[key]) map[key] = [];
      map[key].push(event);
    });
    Object.values(map).forEach((events) => events.sort((a, b) => new Date(b.performed_at) - new Date(a.performed_at)));
    return map;
  }, [allEvents]);

  const cells = [];
  const firstDay = monthStart.getDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1;
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let day = 1; day <= new Date(year, month + 1, 0).getDate(); day++) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);

  function grouped(day) {
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const events = byDay[key] || [];
    return TIPI.map((type) => ({ type, events: events.filter((event) => event.type === type) })).filter((group) => group.events.length);
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
      const endpoint = editing.source === "watering" ? "/api/plant-watering" : "/api/plant-actions";
      const body = editing.source === "watering"
        ? { id: editing.id, wateredAt: `${editDate}T12:00:00` }
        : { id: editing.id, performedAt: `${editDate}T12:00:00` };
      const response = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Errore nella modifica.");
      setEditing(null);
      setSelected(null);
      await loadData();
    } catch (err) {
      setError(err.message || "Errore nella modifica.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteSelected(ids) {
    if (!ids.length || !selected) return;
    const label = ids.length === 1 ? "questa attività" : `queste ${ids.length} attività`;
    if (!window.confirm(`Eliminare ${label}?`)) return;

    setSaving(true);
    try {
      const endpoint = selected.type === "innaffiata" ? "/api/plant-watering" : "/api/plant-actions";
      const response = await fetch(endpoint, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Errore nell'eliminazione.");
      setSelectedIds([]);
      setSelected(null);
      await loadData();
    } catch (err) {
      setError(err.message || "Errore nell'eliminazione.");
    } finally {
      setSaving(false);
    }
  }

  function renderEventGroup(group, day, key) {
    return (
      <div
        key={group.type}
        className="event-icon-wrap"
        onMouseEnter={() => setHovered(`${key}:${group.type}`)}
        onMouseLeave={() => setHovered(null)}
      >
        <button
          type="button"
          onClick={() => openGroup(group.type, group.events, day)}
          aria-label={`Visualizza ${LABELS[group.type]}`}
          className="event-icon"
        >
          <span>{ICONS[group.type]}</span>
          {group.events.length > 1 && <small>{group.events.length}</small>}
        </button>
        {hovered === `${key}:${group.type}` && (
          <div className="tooltip">
            {group.events.map((event) => <div key={event.id}>{event.plant_name}</div>)}
          </div>
        )}
      </div>
    );
  }

  const todayKey = dateKey(new Date());

  return (
    <main className="calendar-page">
      <a href="/" className="back-link">← Torna alla Home</a>

      <header className="calendar-header">
        <h1>📅 Calendario</h1>
        <p>Una visione completa del mese con tutte le cure registrate.</p>
        <div className="legend">
          <span>💧 Irrigazioni</span>
          <span>✂️ Potature</span>
          <span>🌿 Concimazioni</span>
        </div>
      </header>

      {error && <div className="error-box">⚠️ {error}</div>}

      <section className="calendar-card">
        <div className="month-nav">
          <button type="button" onClick={() => setCalendarMonth(new Date(year, month - 1, 1))} aria-label="Mese precedente">←</button>
          <h2>{mesi[month]} {year}</h2>
          <button type="button" onClick={() => setCalendarMonth(new Date(year, month + 1, 1))} aria-label="Mese successivo">→</button>
        </div>

        <div className="calendar-table" aria-label={`Calendario ${mesi[month]} ${year}`}>
          <div className="weekdays">
            {giorniSettimana.map((giorno) => <div key={giorno}>{giorno}</div>)}
          </div>

          <div className="calendar-grid">
            {cells.map((day, index) => {
              if (!day) return <div key={`empty-${index}`} className="day-cell empty" aria-hidden="true" />;
              const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const groups = grouped(day);
              return (
                <div key={key} className={`day-cell ${key === todayKey ? "today" : ""}`}>
                  <div className="day-number">{day}</div>
                  <div className="day-icons">
                    {groups.map((group) => renderEventGroup(group, day, key))}
                  </div>
                  {groups.length > 0 && (
                    <div className="day-summary">
                      {groups.reduce((total, group) => total + group.events.length, 0)} attività
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {loading && <p className="loading">Caricamento attività...</p>}
      </section>

      {selected && (
        <div className="overlay" onClick={() => setSelected(null)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <button type="button" onClick={() => setSelected(null)} className="close-button" aria-label="Chiudi">×</button>
            <h2>{ICONS[selected.type]} {LABELS[selected.type]}{selected.events.length > 1 ? " — dettaglio" : ""}</h2>
            <p className="modal-date">{selected.day} {mesi[month].toLowerCase()} {year}</p>

            <div className="modal-list">
              {selected.events.map((event) => (
                <div key={event.id} className="event-row">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(event.id)}
                    onChange={(e) => setSelectedIds((ids) => e.target.checked ? [...ids, event.id] : ids.filter((id) => id !== event.id))}
                    aria-label={`Seleziona ${event.plant_name}`}
                  />
                  <div className="event-info">
                    <strong>{event.plant_name}</strong>
                    <span>{event.collection || (event.type === "innaffiata" ? "Irrigazione" : "Attività")}</span>
                    <span>{formatDate(event.performed_at)}</span>
                  </div>
                  <button type="button" onClick={() => startEdit(event)} disabled={saving} className="mini-button" aria-label="Modifica">✏️</button>
                  <button type="button" onClick={() => deleteSelected([event.id])} disabled={saving} className="mini-delete" aria-label="Elimina">🗑️</button>
                </div>
              ))}
            </div>

            {selectedIds.length > 0 && (
              <button type="button" onClick={() => deleteSelected(selectedIds)} disabled={saving} className="delete-selected">
                🗑️ Elimina selezionate ({selectedIds.length})
              </button>
            )}
          </div>
        </div>
      )}

      {editing && (
        <div className="overlay" onClick={() => setEditing(null)}>
          <div className="modal edit-modal" onClick={(event) => event.stopPropagation()}>
            <button type="button" onClick={() => setEditing(null)} className="close-button" aria-label="Chiudi">×</button>
            <h2>{ICONS[editing.type]} Modifica {LABELS[editing.type].toLowerCase()}</h2>
            <p><strong>{editing.plant_name}</strong></p>
            <label htmlFor="edit-date">Data attività</label>
            <input id="edit-date" type="date" value={editDate} onChange={(event) => setEditDate(event.target.value)} />
            <div className="modal-actions">
              <button type="button" onClick={saveEdit} disabled={saving || !editDate} className="primary-button">💾 Salva</button>
              <button type="button" onClick={() => setEditing(null)} className="secondary-button">Annulla</button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .calendar-page { max-width:1100px; margin:0 auto; padding:40px 24px 60px; font-family:Georgia,serif; color:#354d3b; }
        .back-link { color:#55745b; text-decoration:none; font-weight:600; }
        .calendar-header h1 { font-size:42px; margin:30px 0 8px; }
        .calendar-header p { color:#6b756d; font-size:18px; margin:0 0 18px; }
        .legend { display:flex; gap:18px; flex-wrap:wrap; color:#68736b; font:14px Arial,sans-serif; margin-bottom:24px; }
        .error-box { padding:12px 15px; border-radius:12px; background:#fff0ed; color:#b42318; margin-bottom:18px; font:14px Arial,sans-serif; }
        .calendar-card { background:#f5f8f1; border:1px solid #dfe8d8; border-radius:24px; padding:28px; }
        .month-nav { display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:20px; }
        .month-nav h2 { text-align:center; color:#354d3b; margin:0; font-size:25px; }
        .month-nav button { border:1px solid #dfe8d8; background:#fff; color:#354d3b; border-radius:10px; min-width:42px; height:42px; cursor:pointer; font-size:20px; }
        .month-nav button:hover { background:#edf4e9; }
        .calendar-table { width:100%; }
        .weekdays, .calendar-grid { display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); gap:7px; }
        .weekdays > div { text-align:center; font:700 13px Arial,sans-serif; color:#55745b; padding:8px 2px; }
        .day-cell { min-height:112px; background:#fff; border:1px solid #dfe8d8; border-radius:13px; padding:9px; box-sizing:border-box; position:relative; overflow:visible; }
        .day-cell.today { background:#e8f3e2; border:2px solid #55745b; padding:8px; }
        .day-cell.empty { background:transparent; border-color:transparent; }
        .day-number { font:700 14px Arial,sans-serif; color:#354d3b; }
        .day-cell.today .day-number { font-weight:800; }
        .day-icons { display:flex; flex-wrap:wrap; align-items:center; gap:4px; margin-top:12px; }
        .event-icon-wrap { position:relative; display:inline-flex; }
        .event-icon { border:0; background:transparent; cursor:pointer; padding:3px; border-radius:8px; display:inline-flex; align-items:center; gap:1px; font-size:22px; line-height:1; }
        .event-icon:hover { background:#eef4eb; }
        .event-icon small { font:700 10px Arial,sans-serif; color:#55745b; background:#e6efdf; border-radius:9px; padding:2px 4px; }
        .day-summary { margin-top:8px; color:#7b847c; font:11px Arial,sans-serif; }
        .tooltip { position:absolute; z-index:30; left:50%; bottom:calc(100% + 8px); transform:translateX(-50%); min-width:145px; max-width:230px; padding:9px 11px; border-radius:10px; background:#354d3b; color:#fff; font:12px/1.45 Arial,sans-serif; box-shadow:0 8px 24px rgba(0,0,0,.15); pointer-events:none; }
        .loading { text-align:center; color:#68736b; margin:18px 0 0; font:14px Arial,sans-serif; }
        .overlay { position:fixed; inset:0; z-index:100; background:rgba(0,0,0,.35); display:flex; align-items:center; justify-content:center; padding:20px; box-sizing:border-box; }
        .modal { width:100%; max-width:520px; max-height:85vh; overflow:auto; background:#fff; border-radius:22px; padding:25px; box-sizing:border-box; position:relative; font-family:Arial,sans-serif; box-shadow:0 18px 60px rgba(0,0,0,.2); }
        .modal h2 { margin:0 35px 5px 0; color:#354d3b; font-family:Georgia,serif; }
        .modal-date { color:#68736b; margin:0 0 18px; }
        .close-button { position:absolute; right:14px; top:10px; border:0; background:transparent; font-size:29px; cursor:pointer; color:#777; }
        .modal-list { display:grid; gap:8px; }
        .event-row { display:flex; align-items:center; gap:9px; padding:10px; border:1px solid #e2e8df; border-radius:12px; background:#fafcf9; }
        .event-row input { flex:0 0 auto; width:18px; height:18px; accent-color:#55745b; }
        .event-info { min-width:0; flex:1; display:flex; flex-direction:column; gap:2px; }
        .event-info strong { color:#354d3b; overflow-wrap:anywhere; }
        .event-info span { color:#7a827b; font-size:12px; }
        .mini-button, .mini-delete { border:0; background:transparent; cursor:pointer; font-size:18px; padding:6px; border-radius:8px; }
        .mini-button:hover { background:#edf4e9; }
        .mini-delete:hover { background:#fff0ed; }
        .mini-button:disabled, .mini-delete:disabled { opacity:.45; cursor:default; }
        .delete-selected { width:100%; margin-top:14px; border:0; border-radius:12px; padding:12px 15px; background:#b42318; color:#fff; cursor:pointer; font-weight:700; }
        .edit-modal { max-width:420px; }
        .edit-modal label { display:block; color:#68736b; margin:18px 0 8px; font-size:14px; }
        .edit-modal input[type="date"] { width:100%; box-sizing:border-box; padding:11px; border-radius:10px; border:1px solid #dfe8d8; font-size:16px; }
        .modal-actions { display:flex; gap:8px; margin-top:16px; }
        .primary-button, .secondary-button { border:0; border-radius:12px; padding:11px 15px; cursor:pointer; font-weight:700; }
        .primary-button { background:#55745b; color:#fff; }
        .secondary-button { background:#777; color:#fff; }
        .primary-button:disabled { opacity:.5; cursor:default; }

        @media (max-width:700px) {
          .calendar-page { padding:24px 12px 45px; }
          .calendar-header h1 { font-size:32px; margin-top:24px; }
          .calendar-header p { font-size:15px; line-height:1.4; }
          .legend { gap:8px 14px; font-size:12px; margin-bottom:17px; }
          .calendar-card { padding:12px 7px 15px; border-radius:18px; }
          .month-nav { margin:2px 3px 12px; }
          .month-nav h2 { font-size:20px; }
          .month-nav button { min-width:38px; height:38px; font-size:18px; }
          .weekdays, .calendar-grid { gap:3px; }
          .weekdays > div { padding:6px 0; font-size:10px; }
          .day-cell { min-height:74px; border-radius:8px; padding:6px 4px; }
          .day-cell.today { padding:5px 3px; }
          .day-number { font-size:12px; }
          .day-icons { gap:1px; margin-top:7px; justify-content:center; }
          .event-icon { font-size:18px; padding:2px 1px; }
          .event-icon small { font-size:8px; padding:1px 3px; }
          .day-summary { display:none; }
          .tooltip { display:none; }
          .modal { align-self:flex-end; max-height:88vh; border-radius:22px 22px 0 0; padding:21px 17px calc(21px + env(safe-area-inset-bottom)); }
          .overlay { align-items:flex-end; padding:0; }
          .event-row { gap:7px; }
          .event-info strong { font-size:14px; }
          .mini-button, .mini-delete { padding:8px 5px; }
        }

        @media (max-width:360px) {
          .day-cell { min-height:68px; padding:5px 2px; }
          .day-cell.today { padding:4px 1px; }
          .event-icon { font-size:16px; }
          .month-nav h2 { font-size:18px; }
        }
      `}</style>
    </main>
  );
}
