"use client";

import { useEffect, useMemo, useState } from "react";

const mesi = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
const giorniSettimana = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
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
    Object.values(map).forEach((events) => events.sort((a, b) => new Date(b.performed_at) - new Date(a.performed_at)));
    return map;
  }, [allEvents]);

  const cells = [];
  const firstDay = monthStart.getDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1;
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let day = 1; day <= new Date(year, month + 1, 0).getDate(); day++) cells.push(day);

  function grouped(day) {
    const events = byDay[`${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`] || [];
    return ["innaffiata", "potata", "concimata"].map((type) => ({ type, events: events.filter((e) => e.type === type) })).filter((g) => g.events.length);
  }

  function openGroup(type, events, day) {
    setSelected({ type, day, events });
    setSelectedIds([]);
    setEditing(null);
  }

  function startEdit(event) {
    if (event.readOnly) return;
    setEditing(event);
    setEditDate(isoDate(event.performed_at));
    setSelectedIds([]);
  }

  async function saveEdit() {
    if (!editing || !editDate || editing.readOnly) return;
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
      setSelected(null);
      await loadData();
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
      setSelected(null);
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const todayKey = dateKey(new Date());
  const mobileDays = Object.entries(byDay)
    .filter(([key]) => key.startsWith(`${year}-${String(month + 1).padStart(2, "0")}-`))
    .sort(([a], [b]) => a.localeCompare(b));

  return (
    <main className="calendar-page">
      <a href="/" className="back-link">← Torna alla Home</a>
      <header className="calendar-header">
        <h1>📅 Calendario</h1>
        <p>Le cure e le attività del nostro terrazzo.</p>
        <div className="legend"><span>💧 Irrigazioni</span><span>✂️ Potature</span><span>🌿 Concimazioni</span></div>
      </header>
      {error && <div className="error-box">⚠️ {error}</div>}

      <section className="calendar-card">
        <div className="month-nav">
          <button onClick={() => setCalendarMonth(new Date(year, month - 1, 1))} aria-label="Mese precedente">←</button>
          <h2>{mesi[month]} {year}</h2>
          <button onClick={() => setCalendarMonth(new Date(year, month + 1, 1))} aria-label="Mese successivo">→</button>
        </div>

        <div className="desktop-calendar">
          <div className="weekdays">{giorniSettimana.map((g) => <div key={g}>{g}</div>)}</div>
          <div className="calendar-grid">
            {cells.map((day, index) => {
              const groups = day ? grouped(day) : [];
              const key = day ? `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}` : "";
              return <div key={index} className={`day-cell ${key === todayKey ? "today" : ""}`}>
                {day && <>
                  <div className="day-number">{day}</div>
                  <div className="day-icons">
                    {groups.map((group) => <div key={group.type} className="event-icon-wrap" onMouseEnter={() => setHovered(`${key}:${group.type}`)} onMouseLeave={() => setHovered(null)}>
                      <button onClick={() => openGroup(group.type, group.events, day)} aria-label={`Visualizza ${LABELS[group.type]}`} className="event-icon">
                        {ICONS[group.type]}{group.events.length > 1 && <small>{group.events.length}</small>}
                      </button>
                      {hovered === `${key}:${group.type}` && <div className="tooltip">{group.events.map((event) => <div key={event.id}>{event.plant_name}</div>)}</div>}
                    </div>)}
                  </div>
                </>}
              </div>;
            })}
          </div>
        </div>

        <div className="mobile-agenda">
          {mobileDays.length === 0 && !loading && <div className="empty-month">Nessuna attività registrata questo mese.</div>}
          {mobileDays.map(([key, events]) => {
            const d = new Date(`${key}T12:00:00`);
            const dayGroups = ["innaffiata", "potata", "concimata"].map((type) => ({ type, events: events.filter((e) => e.type === type) })).filter((g) => g.events.length);
            return <div key={key} className={`agenda-day ${key === todayKey ? "today" : ""}`}>
              <div className="agenda-date"><strong>{d.getDate()}</strong><span>{d.toLocaleDateString("it-IT", { weekday: "long" })}</span></div>
              <div className="agenda-events">
                {dayGroups.map((group) => <button key={group.type} className="agenda-group" onClick={() => openGroup(group.type, group.events, d.getDate())}>
                  <span className="agenda-icon">{ICONS[group.type]}</span>
                  <span className="agenda-copy"><strong>{LABELS[group.type]}</strong><small>{group.events.length === 1 ? group.events[0].plant_name : `${group.events.length} attività`}</small></span>
                  <span className="chevron">›</span>
                </button>)}
              </div>
            </div>;
          })}
        </div>
        {loading && <p className="loading">Caricamento attività...</p>}
      </section>

      {selected && <div className="overlay" onClick={() => setSelected(null)}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => setSelected(null)} className="close-button" aria-label="Chiudi">×</button>
          <h2>{ICONS[selected.type]} {LABELS[selected.type]}</h2>
          <p className="modal-date">{selected.day} {mesi[month].toLowerCase()} {year}</p>
          <div className="modal-list">
            {selected.events.map((event) => <div key={event.id} className="event-row">
              {!event.readOnly && <input type="checkbox" checked={selectedIds.includes(event.id)} onChange={(e) => setSelectedIds((ids) => e.target.checked ? [...ids, event.id] : ids.filter((id) => id !== event.id))} />}
              <div className="event-info"><strong>{event.plant_name}</strong><span>{formatDate(event.performed_at)}</span></div>
              {event.readOnly ? <span className="readonly-label">Solo visualizzazione</span> : <>
                <button onClick={() => startEdit(event)} disabled={saving} className="mini-button" aria-label="Modifica">✏️</button>
                <button onClick={() => deleteSelected([event.id])} disabled={saving} className="mini-delete" aria-label="Elimina">🗑️</button>
              </>}
            </div>)}
          </div>
          {selected.type !== "innaffiata" && selectedIds.length > 0 && <button onClick={() => deleteSelected(selectedIds)} disabled={saving} className="delete-selected">🗑️ Elimina selezionate ({selectedIds.length})</button>}
        </div>
      </div>}

      {editing && <div className="overlay" onClick={() => setEditing(null)}>
        <div className="modal edit-modal" onClick={(e) => e.stopPropagation()}>
          <h2>{ICONS[editing.type]} Modifica attività</h2>
          <p><strong>{editing.plant_name}</strong></p>
          <label htmlFor="edit-date">Data attività</label>
          <input id="edit-date" type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
          <div className="modal-actions"><button onClick={saveEdit} disabled={saving} className="primary-button">💾 Salva</button><button onClick={() => setEditing(null)} className="secondary-button">Annulla</button></div>
        </div>
      </div>}

      <style jsx>{`
        .calendar-page { max-width:1100px; margin:0 auto; padding:40px 24px 60px; font-family:Georgia,serif; color:#354d3b; }
        .back-link { color:#55745b; text-decoration:none; font-weight:600; }
        .calendar-header h1 { font-size:42px; margin:30px 0 8px; }
        .calendar-header p { color:#6b756d; font-size:18px; margin:0 0 18px; }
        .legend { display:flex; gap:18px; flex-wrap:wrap; color:#68736b; font:14px Arial,sans-serif; margin-bottom:24px; }
        .error-box { padding:12px 15px; border-radius:12px; background:#fff0ed; color:#b42318; margin-bottom:18px; font-family:Arial,sans-serif; }
        .calendar-card { background:#f5f8f1; border:1px solid #dfe8d8; border-radius:24px; padding:28px; }
        .month-nav { display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:20px; }
        .month-nav h2 { text-align:center; margin:0; font-size:25px; }
        .month-nav button { border:1px solid #dfe8d8; background:#fff; border-radius:10px; padding:8px 14px; cursor:pointer; font-size:18px; color:#354d3b; min-width:44px; min-height:44px; }
        .weekdays,.calendar-grid { display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); gap:8px; }
        .weekdays { margin-bottom:8px; }
        .weekdays div { text-align:center; font-weight:700; color:#55745b; padding:8px 2px; }
        .day-cell { min-height:100px; background:#fff; border:1px solid #dfe8d8; border-radius:12px; padding:8px; position:relative; }
        .day-cell.today { background:#e2efd9; }
        .day-number { font-weight:600; margin-bottom:8px; }
        .today .day-number { font-weight:800; }
        .day-icons { display:flex; flex-wrap:wrap; gap:4px; }
        .event-icon-wrap { position:relative; display:inline-block; }
        .event-icon { border:none; background:transparent; cursor:pointer; font-size:22px; padding:4px; display:inline-flex; align-items:center; }
        .event-icon small { font:700 10px Arial,sans-serif; margin-left:2px; }
        .tooltip { position:absolute; z-index:20; left:50%; bottom:calc(100% + 8px); transform:translateX(-50%); min-width:150px; padding:9px 11px; border-radius:10px; background:#354d3b; color:#fff; font:13px Arial,sans-serif; white-space:nowrap; }
        .mobile-agenda { display:none; }
        .loading { text-align:center; color:#68736b; margin:18px 0 0; font-family:Arial,sans-serif; }
        .overlay { position:fixed; inset:0; z-index:100; background:rgba(20,30,22,.48); display:flex; align-items:center; justify-content:center; padding:18px; }
        .modal { width:min(620px,100%); max-height:85vh; overflow:auto; background:#fff; border-radius:22px; padding:24px; position:relative; box-shadow:0 20px 60px rgba(0,0,0,.2); font-family:Arial,sans-serif; }
        .modal h2 { margin:0 35px 4px 0; color:#354d3b; font-family:Georgia,serif; }
        .modal-date { color:#68736b; margin:0 0 16px; }
        .close-button { position:absolute; top:12px; right:14px; border:none; background:transparent; font-size:30px; color:#55745b; cursor:pointer; }
        .modal-list { display:grid; gap:8px; }
        .event-row { display:flex; align-items:center; gap:10px; padding:11px 12px; border-radius:12px; background:#f5f8f1; min-width:0; }
        .event-info { flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; }
        .event-info strong { overflow-wrap:anywhere; }
        .event-info span { color:#68736b; font-size:13px; }
        .readonly-label { color:#68736b; font-size:12px; white-space:nowrap; }
        .mini-button,.mini-delete { border:none; background:transparent; cursor:pointer; font-size:18px; padding:7px; }
        .mini-delete { color:#c62828; }
        .delete-selected { width:100%; border:none; border-radius:12px; padding:12px; margin-top:14px; background:#b42318; color:#fff; font-weight:700; cursor:pointer; }
        .edit-modal label { display:block; color:#68736b; margin:18px 0 8px; }
        .edit-modal input { width:100%; box-sizing:border-box; padding:12px; border:1px solid #cfd9cb; border-radius:10px; font-size:16px; }
        .modal-actions { display:flex; gap:8px; margin-top:16px; }
        .primary-button,.secondary-button { flex:1; border:none; border-radius:12px; padding:12px 16px; color:#fff; background:#55745b; font-weight:700; cursor:pointer; }
        .secondary-button { background:#777; }
        @media (max-width:700px) {
          .calendar-page { padding:22px 12px 40px; }
          .calendar-header h1 { font-size:32px; margin-top:22px; }
          .calendar-header p { font-size:16px; }
          .legend { gap:8px 14px; margin-bottom:16px; }
          .calendar-card { padding:14px; border-radius:18px; }
          .month-nav { margin-bottom:12px; }
          .month-nav h2 { font-size:21px; }
          .month-nav button { min-width:42px; min-height:42px; padding:7px 10px; }
          .desktop-calendar { display:none; }
          .mobile-agenda { display:grid; gap:9px; }
          .agenda-day { display:grid; grid-template-columns:58px minmax(0,1fr); gap:10px; padding:10px; border:1px solid #dfe8d8; border-radius:15px; background:#fff; }
          .agenda-day.today { background:#e2efd9; }
          .agenda-date { display:flex; flex-direction:column; align-items:center; justify-content:center; border-right:1px solid #dfe8d8; padding-right:9px; }
          .agenda-date strong { font-size:25px; line-height:1; }
          .agenda-date span { font:12px Arial,sans-serif; color:#68736b; margin-top:5px; text-transform:capitalize; text-align:center; }
          .agenda-events { display:grid; gap:6px; min-width:0; }
          .agenda-group { width:100%; display:flex; align-items:center; gap:10px; border:none; background:#f5f8f1; border-radius:11px; padding:10px; text-align:left; color:#354d3b; cursor:pointer; min-height:54px; }
          .agenda-icon { font-size:22px; flex:none; }
          .agenda-copy { flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; }
          .agenda-copy strong { font:700 14px Arial,sans-serif; }
          .agenda-copy small { color:#68736b; font:13px Arial,sans-serif; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
          .chevron { font-size:23px; color:#55745b; }
          .empty-month { padding:28px 10px; text-align:center; color:#68736b; font:14px Arial,sans-serif; }
          .modal { border-radius:18px; padding:20px 16px; max-height:90vh; }
          .event-row { padding:10px 8px; }
          .readonly-label { display:none; }
          .mini-button,.mini-delete { padding:8px 5px; }
          .overlay { align-items:flex-end; padding:0; }
          .overlay .modal { width:100%; max-height:88vh; border-radius:22px 22px 0 0; }
        }
      `}</style>
    </main>
  );
}
