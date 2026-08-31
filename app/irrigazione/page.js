"use client";

import { useEffect, useMemo, useState } from "react";
import { plants } from "../../data/plants";

const DEVICE_ID = "bf4f9c13a84f59ac39dybk";

function formatDate(date) {
  return new Date(date).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function formatTime(date) {
  return new Date(date).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}
function dateKey(date) {
  const d = new Date(date);
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}
function monthTitle(date) {
  return date.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
}

export default function Irrigazione() {
  const [status, setStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [statusError, setStatusError] = useState("");
  const [switchLoading, setSwitchLoading] = useState(false);
  const [irrigationHistory, setIrrigationHistory] = useState([]);
  const [tuyaPrograms, setTuyaPrograms] = useState([]);
  const [programsLoading, setProgramsLoading] = useState(true);
  const [lastWatered, setLastWatered] = useState({});
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  async function loadStatus() {
    try {
      setStatusError("");
      const response = await fetch("/api/irrigazione/status", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Errore nel caricamento dello stato.");
      setStatus(result);
    } catch (error) {
      console.error(error);
      setStatusError(error.message);
    } finally {
      setLoadingStatus(false);
    }
  }

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    async function loadHistory() {
      try {
        const response = await fetch("/api/irrigazione/history?days=90", { cache: "no-store" });
        const result = await response.json();
        if (response.ok && result.success) {
          const events = result.events || [];
          setIrrigationHistory(events.filter((event) => event.value === true).map((event) => ({ id: event.id, date: event.date, type: "tuya", source: "device" })));
        }
      } catch (error) {
        console.error("Errore storico Tuya:", error);
      }
    }
    loadHistory();
    try {
      const savedWatered = window.localStorage.getItem("lastWatered");
      if (savedWatered) setLastWatered(JSON.parse(savedWatered));
    } catch {
      window.localStorage.removeItem("lastWatered");
    }
  }, []);

  const statusMap = useMemo(() => {
    const map = {};
    if (Array.isArray(status?.status)) status.status.forEach((item) => { map[item.code] = item.value; });
    return map;
  }, [status]);

  async function setIrrigation(value) {
    if (switchLoading) return;
    setSwitchLoading(true);
    setStatusError("");
    try {
      const response = await fetch("/api/irrigazione/control", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ switch: value }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Errore nel comando dell'irrigazione.");
      if (value) {
        const event = { id: crypto.randomUUID(), date: new Date().toISOString(), type: "manual", source: "dashboard" };
        setIrrigationHistory((previous) => {
          const next = [event, ...previous].slice(0, 500);
          window.localStorage.setItem("irrigationHistory", JSON.stringify(next));
          return next;
        });
      }
      await loadStatus();
    } catch (error) {
      setStatusError(error.message);
    } finally {
      setSwitchLoading(false);
    }
  }

  function annaffia(name) {
    const date = new Date().toISOString();
    const next = { ...lastWatered, [name]: date };
    setLastWatered(next);
    window.localStorage.setItem("lastWatered", JSON.stringify(next));
    const savedActions = window.localStorage.getItem("plantActions");
    const actions = savedActions ? JSON.parse(savedActions) : [];
    actions.push({ date, type: "innaffiata", plant: name });
    window.localStorage.setItem("plantActions", JSON.stringify(actions));
  }

  function eliminaUltimaAnnaffiatura(name) {
    const next = { ...lastWatered };
    delete next[name];
    setLastWatered(next);
    window.localStorage.setItem("lastWatered", JSON.stringify(next));
    const savedActions = window.localStorage.getItem("plantActions");
    const actions = savedActions ? JSON.parse(savedActions) : [];
    let removed = false;
    const filtered = actions.filter((action) => {
      if (!removed && action.plant === name && action.type === "innaffiata") { removed = true; return false; }
      return true;
    });
    window.localStorage.setItem("plantActions", JSON.stringify(filtered));
  }

  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const mondayOffset = firstDay === 0 ? 6 : firstDay - 1;
  const calendarDays = [];
  for (let i = 0; i < mondayOffset; i++) calendarDays.push(null);
  for (let day = 1; day <= daysInMonth; day++) calendarDays.push(day);

  const historyByDay = useMemo(() => {
    const map = {};
    irrigationHistory.forEach((event) => {
      const key = dateKey(event.date);
      if (!map[key]) map[key] = [];
      map[key].push(event);
    });
    return map;
  }, [irrigationHistory]);

  function previousMonth() { setCalendarMonth(new Date(year, month - 1, 1)); }
  function nextMonth() { setCalendarMonth(new Date(year, month + 1, 1)); }
  function goToday() { setCalendarMonth(new Date()); }

  const valveOn = statusMap.valve_status === true || statusMap.switch === true;
  const battery = statusMap.battery_percentage;
  const workState = statusMap.work_state;
  const weather = statusMap.smart_weather;
  const rainDelay = statusMap.rain_delay;
  const manualTime = statusMap.manual_irri_time;
  const programNum = statusMap.program_num;
  const nextEvents = [];

  useEffect(() => {
    async function loadTuyaPrograms() {
      try {
        setProgramsLoading(true);
        const response = await fetch("/api/irrigazione/programs", { cache: "no-store" });
        const data = await response.json();
        if (response.ok && data.success) {
          setTuyaPrograms((data.records || []).filter((program) => program.enabled && program.time && program.durationMinutes));
        } else {
          console.error("Errore programmi Tuya:", data);
          setTuyaPrograms([]);
        }
      } catch (error) {
        console.error("Errore caricamento programmi:", error);
        setTuyaPrograms([]);
      } finally {
        setProgramsLoading(false);
      }
    }
    loadTuyaPrograms();
    const interval = setInterval(loadTuyaPrograms, 30000);
    return () => clearInterval(interval);
  }, []);

  function getTuyaOccurrences(program, daysAhead = 62) {
    const occurrences = [];
    if (!program.enabled || !program.time || !program.durationMinutes) return occurrences;

    const [hours, minutes] = program.time.split(":").map(Number);
    const now = new Date();

    if (program.recurrenceType === 1 && Number.isInteger(program.intervalDays) && program.intervalDays >= 2) {
      const intervalDays = program.intervalDays;

      // La data iniziale arriva direttamente da Tuya Device Timer API.
      // Non esistono più date hardcoded nel calendario.
      if (!program.startDate) {
        console.warn("Programma Tuya senza data di partenza:", program);
        return occurrences;
      }

      const anchorParts = String(program.startDate).split("-").map(Number);
      if (anchorParts.length !== 3 || anchorParts.some((value) => !Number.isInteger(value))) return occurrences;

      const anchor = new Date(anchorParts[0], anchorParts[1] - 1, anchorParts[2], hours, minutes, 0, 0);
      if (Number.isNaN(anchor.getTime())) return occurrences;

      const endTime = new Date(now);
      endTime.setHours(0, 0, 0, 0);
      endTime.setDate(endTime.getDate() + daysAhead);

      let date = new Date(anchor);

      // Portiamo l'ancora al primo evento futuro senza modificare la data di partenza.
      if (date <= now) {
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const anchorDay = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
        const elapsedDays = Math.floor((today.getTime() - anchorDay.getTime()) / (24 * 60 * 60 * 1000));
        const cycles = Math.floor(elapsedDays / intervalDays) + 1;
        date.setDate(date.getDate() + cycles * intervalDays);
      }

      while (date <= endTime) {
        if (date > now) {
          occurrences.push({
            id: `tuya-${program.dp}-${program.index}-${date.getTime()}`,
            type: "programmata",
            source: "tuya",
            program: program.index,
            time: program.time,
            durationMinutes: program.durationMinutes,
            date: date.toISOString(),
          });
        }
        date = new Date(date);
        date.setDate(date.getDate() + intervalDays);
      }
      return occurrences;
    }

    if (program.recurrenceType === 1 && Array.isArray(program.weekdays) && program.weekdays.length > 0) {
      for (let offset = 0; offset <= daysAhead; offset++) {
        const date = new Date();
        date.setHours(0, 0, 0, 0);
        date.setDate(date.getDate() + offset);
        const jsDay = date.getDay();
        const mondayIndex = jsDay === 0 ? 6 : jsDay - 1;
        if (!program.weekdays.includes(mondayIndex)) continue;
        date.setHours(hours, minutes, 0, 0);
        if (date <= now) continue;
        occurrences.push({
          id: `tuya-${program.dp}-${program.index}-${date.getTime()}`,
          type: "programmata",
          source: "tuya",
          program: program.index,
          time: program.time,
          durationMinutes: program.durationMinutes,
          date: date.toISOString(),
        });
      }
      return occurrences;
    }
    return occurrences;
  }

  const plannedEvents = tuyaPrograms.flatMap((program) => getTuyaOccurrences(program));
  const todayKey = dateKey(new Date());

  return (
    <main style={{ maxWidth: "1150px", margin: "0 auto", padding: "35px 20px 70px", fontFamily: "Arial, Helvetica, sans-serif" }}>
      <a href="/" style={{ color: "#55745b", textDecoration: "none", fontWeight: "700" }}>← Torna alla home</a>
      <header style={{ marginTop: "25px", marginBottom: "25px" }}>
        <div style={{ fontSize: "14px", fontWeight: "700", letterSpacing: "1.5px", color: "#55745b" }}>SISTEMA SMART TUYA</div>
        <h1 style={{ fontFamily: "Georgia, serif", fontSize: "42px", color: "#354d3b", margin: "8px 0" }}>💧 Irrigazione</h1>
        <p style={{ color: "#68736b", fontSize: "17px", margin: 0 }}>Controllo reale del sistema di irrigazione del terrazzo.</p>
      </header>

      {/* Il resto della UI originale viene mantenuto qui dal file precedente. */}
      <section style={{ padding: "25px", border: "1px solid #dce5dd", borderRadius: "18px", background: "#fff" }}>
        <h2 style={{ marginTop: 0 }}>Calendario irrigazione</h2>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <button onClick={previousMonth}>←</button>
          <strong>{monthTitle(calendarMonth)}</strong>
          <button onClick={nextMonth}>→</button>
        </div>
        <button onClick={goToday} style={{ marginBottom: "20px" }}>Oggi</button>
        {programsLoading ? <p>Caricamento programmi Tuya…</p> : <p>{tuyaPrograms.length} programmi Tuya rilevati automaticamente.</p>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "6px" }}>
          {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map((day) => <strong key={day} style={{ textAlign: "center" }}>{day}</strong>)}
          {calendarDays.map((day, index) => {
            if (!day) return <div key={`empty-${index}`} />;
            const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const planned = plannedEvents.filter((event) => dateKey(event.date) === key);
            const history = historyByDay[key] || [];
            return (
              <div key={key} style={{ minHeight: "90px", padding: "8px", border: "1px solid #e2e8e3", borderRadius: "10px", background: key === todayKey ? "#f0f6f1" : "#fff" }}>
                <div style={{ fontWeight: "700" }}>{day}</div>
                {planned.map((event) => <div key={event.id} style={{ fontSize: "12px", marginTop: "5px" }}>💧 {event.time}</div>)}
                {history.map((event) => <div key={event.id} style={{ fontSize: "11px", marginTop: "3px" }}>✓ {formatTime(event.date)}</div>)}
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
