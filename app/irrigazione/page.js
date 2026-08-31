"use client";

import { useEffect, useMemo, useState } from "react";
import { plants } from "../../data/plants";

const DEVICE_ID = "bf4f9c13a84f59ac39dybk";

function formatDate(date) {
  return new Date(date).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatTime(date) {
  return new Date(date).toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dateKey(date) {
  const d = new Date(date);

  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function monthTitle(date) {
  return date.toLocaleDateString("it-IT", {
    month: "long",
    year: "numeric",
  });
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

  const [calendarMonth, setCalendarMonth] = useState(
    new Date()
  );

  async function loadStatus() {
    try {
      setStatusError("");

      const response = await fetch(
        "/api/irrigazione/status",
        {
          cache: "no-store",
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Errore nel caricamento dello stato."
        );
      }

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

    const interval = setInterval(
      loadStatus,
      30000
    );

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    async function loadHistory() {
      try {
        const response = await fetch(
          "/api/irrigazione/history?days=90",
          {
            cache: "no-store",
          }
        );

        const result =
          await response.json();

        if (
          response.ok &&
          result.success
        ) {
          const events =
            result.events || [];

          setIrrigationHistory(
            events
              .filter(
                (event) =>
                  event.value === true
              )
              .map((event) => ({
                id: event.id,
                date: event.date,
                type: "tuya",
                source: "device",
              }))
          );
        }
      } catch (error) {
        console.error(
          "Errore storico Tuya:",
          error
        );
      }
    }

    loadHistory();

    try {
      const savedWatered =
        window.localStorage.getItem(
          "lastWatered"
        );

      if (savedWatered) {
        setLastWatered(
          JSON.parse(savedWatered)
        );
      }
    } catch {
      window.localStorage.removeItem(
        "lastWatered"
      );
    }
  }, []);

  const statusMap = useMemo(() => {
    const map = {};

    if (Array.isArray(status?.status)) {
      status.status.forEach((item) => {
        map[item.code] = item.value;
      });
    }

    return map;
  }, [status]);

  async function setIrrigation(value) {
    if (switchLoading) return;

    setSwitchLoading(true);
    setStatusError("");

    try {
      const response = await fetch(
        "/api/irrigazione/control",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            switch: value,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Errore nel comando dell'irrigazione."
        );
      }

      /*
       * Registriamo solo l'avvio reale dalla dashboard.
       * Il successivo refresh dello stato Tuya conferma
       * lo stato effettivo della valvola.
       */
      if (value) {
        const event = {
          id: crypto.randomUUID(),
          date: new Date().toISOString(),
          type: "manual",
          source: "dashboard",
        };

        setIrrigationHistory((previous) => {
          const next = [
            event,
            ...previous,
          ].slice(0, 500);

          window.localStorage.setItem(
            "irrigationHistory",
            JSON.stringify(next)
          );

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
    const date =
      new Date().toISOString();

    const next = {
      ...lastWatered,
      [name]: date,
    };

    setLastWatered(next);

    window.localStorage.setItem(
      "lastWatered",
      JSON.stringify(next)
    );

    const savedActions =
      window.localStorage.getItem(
        "plantActions"
      );

    const actions = savedActions
      ? JSON.parse(savedActions)
      : [];

    actions.push({
      date,
      type: "innaffiata",
      plant: name,
    });

    window.localStorage.setItem(
      "plantActions",
      JSON.stringify(actions)
    );
  }

  function eliminaUltimaAnnaffiatura(name) {
    const next = {
      ...lastWatered,
    };

    delete next[name];

    setLastWatered(next);

    window.localStorage.setItem(
      "lastWatered",
      JSON.stringify(next)
    );

    const savedActions =
      window.localStorage.getItem(
        "plantActions"
      );

    const actions = savedActions
      ? JSON.parse(savedActions)
      : [];

    let removed = false;

    const filtered = actions.filter(
      (action) => {
        if (
          !removed &&
          action.plant === name &&
          action.type ===
            "innaffiata"
        ) {
          removed = true;
          return false;
        }

        return true;
      }
    );

    window.localStorage.setItem(
      "plantActions",
      JSON.stringify(filtered)
    );
  }

  const year =
    calendarMonth.getFullYear();

  const month =
    calendarMonth.getMonth();

  const daysInMonth = new Date(
    year,
    month + 1,
    0
  ).getDate();

  const firstDay =
    new Date(
      year,
      month,
      1
    ).getDay();

  const mondayOffset =
    firstDay === 0
      ? 6
      : firstDay - 1;

  const calendarDays = [];

  for (
    let i = 0;
    i < mondayOffset;
    i++
  ) {
    calendarDays.push(null);
  }

  for (
    let day = 1;
    day <= daysInMonth;
    day++
  ) {
    calendarDays.push(day);
  }

  const historyByDay = useMemo(() => {
    const map = {};

    irrigationHistory.forEach(
      (event) => {
        const key = dateKey(event.date);

        if (!map[key]) {
          map[key] = [];
        }

        map[key].push(event);
      }
    );

    return map;
  }, [irrigationHistory]);

  function previousMonth() {
    setCalendarMonth(
      new Date(year, month - 1, 1)
    );
  }

  function nextMonth() {
    setCalendarMonth(
      new Date(year, month + 1, 1)
    );
  }

  function goToday() {
    setCalendarMonth(new Date());
  }

  const valveOn =
    statusMap.valve_status === true ||
    statusMap.switch === true;

  const battery =
    statusMap.battery_percentage;

  const workState =
    statusMap.work_state;

  const weather =
    statusMap.smart_weather;

  const rainDelay =
    statusMap.rain_delay;

  const manualTime =
    statusMap.manual_irri_time;

  const programNum =
    statusMap.program_num;

  const nextEvents = [];

  /*
   * I programmi Tuya sono ancora codificati.
   * NON inventiamo date/orari.
   *
   * Quando completiamo il decoder di
   * water_program1-4 e irri_time,
   * questi eventi verranno inseriti qui.
   */
  useEffect(() => {
    async function loadTuyaPrograms() {
      try {
        setProgramsLoading(true);

        const response = await fetch(
          "/api/irrigazione/programs",
          { cache: "no-store" }
        );

        const data = await response.json();

        if (response.ok && data.success) {
          setTuyaPrograms(
            (data.records || []).filter(
              (program) =>
                program.enabled &&
                program.time &&
                program.durationMinutes
            )
          );
        } else {
          console.error(
            "Errore programmi Tuya:",
            data
          );
          setTuyaPrograms([]);
        }
      } catch (error) {
        console.error(
          "Errore caricamento programmi:",
          error
        );
        setTuyaPrograms([]);
      } finally {
        setProgramsLoading(false);
      }
    }

    loadTuyaPrograms();

    const interval = setInterval(
      loadTuyaPrograms,
      30000
    );

    return () => clearInterval(interval);
  }, []);

  /*
   * Programmi Tuya letti direttamente dal dispositivo.
   *
   * NON assumiamo ancora il significato dei byte di
   * ricorrenza: il formato proprietario del R2603 va
   * decodificato prima di generare le date.
   *
   * Per ora manteniamo l'orario reale del programma
   * senza inventare il giorno della settimana.
   */
  /*
   * Genera le prossime occorrenze dei programmi Tuya.
   *
   * I programmi possono essere:
   * - settimanali, con weekdays[]
   * - a intervallo, con intervalDays
   */

  function getTuyaOccurrences(program, daysAhead = 62) {
    const occurrences = [];

    if (
      !program.enabled ||
      !program.time ||
      !program.durationMinutes
    ) {
      return occurrences;
    }

    const [hours, minutes] =
      program.time.split(":").map(Number);

    const now = new Date();

    /*
     * PROGRAMMI A INTERVALLO
     *
     * Per il programma attualmente presente
     * alle 20:00, Tuya usa una ricorrenza
     * ogni 3 giorni.
     *
     * La sequenza corretta è:
     * 1, 4, 7, 10, 13, 16...
     *
     * L'ancora non deve essere "oggi", altrimenti
     * ogni aggiornamento della pagina sposterebbe
     * artificialmente la sequenza.
     */
    if (
      program.recurrenceType === 1 &&
      Number.isInteger(program.intervalDays) &&
      program.intervalDays >= 2
    ) {
      const intervalDays = program.intervalDays;

      /*
       * Ancora della programmazione Tuya.
       *
       * Ogni programmazione a intervallo ha la propria
       * data di partenza osservata. Il dispositivo non
       * espone nel record raw decodificato un campo data
       * separato, quindi per i programmi che conosciamo
       * associamo esplicitamente l'ancora alla programmazione.
       *
       * 01/09/2026 -> programma 20:00 ogni 3 giorni
       * 05/09/2026 -> programma 06:00 ogni 4 giorni
       * 04/09/2026 -> programma 12:00 ogni 2 giorni
       */
      const intervalAnchors = {
        "20:00": new Date(
          2026,
          8,
          1,
          hours,
          minutes,
          0,
          0
        ),
        "06:00": new Date(
          2026,
          8,
          5,
          hours,
          minutes,
          0,
          0
        ),
        "12:00": new Date(
          2026,
          8,
          4,
          hours,
          minutes,
          0,
          0
        ),
      };

      const anchor =
        intervalAnchors[program.time];

      /*
       * Se in futuro compare un nuovo programma a
       * intervallo non ancora associato a una data di
       * partenza, non inventiamo una data nel calendario.
       */
      if (!anchor) {
        return occurrences;
      }

      for (
        let date = new Date(anchor);
        date.getTime() <=
          anchor.getTime() +
            daysAhead * 24 * 60 * 60 * 1000;
        date.setDate(
          date.getDate() + intervalDays
        )
      ) {
        if (date <= now) {
          continue;
        }

        occurrences.push({
          id:
            `tuya-${program.dp}-${program.index}-${date.getTime()}`,
          type: "programmata",
          source: "tuya",
          program: program.index,
          time: program.time,
          durationMinutes:
            program.durationMinutes,
          date: date.toISOString(),
        });
      }

      return occurrences;
    }

    /*
     * TYPE 1 = ricorrenza settimanale.
     */
    if (
      program.recurrenceType === 1 &&
      Array.isArray(program.weekdays) &&
      program.weekdays.length > 0
    ) {
      for (
        let offset = 0;
        offset <= daysAhead;
        offset++
      ) {
        const date = new Date();

        date.setHours(0, 0, 0, 0);
        date.setDate(
          date.getDate() + offset
        );

        const jsDay = date.getDay();

        const mondayIndex =
          jsDay === 0 ? 6 : jsDay - 1;

        if (
          !program.weekdays.includes(
            mondayIndex
          )
        ) {
          continue;
        }

        date.setHours(
          hours,
          minutes,
          0,
          0
        );

        if (date <= now) {
          continue;
        }

        occurrences.push({
          id:
            `tuya-${program.dp}-${program.index}-${date.getTime()}`,
          type: "programmata",
          source: "tuya",
          program: program.index,
          time: program.time,
          durationMinutes:
            program.durationMinutes,
          date: date.toISOString(),
        });
      }

      return occurrences;
    }

    /*
     * TYPE 4:
     *
     * Per ora NON lo mostriamo nel calendario.
     *
     * I dati type 4 che il dispositivo continua
     * a restituire possono rappresentare uno slot
     * rimasto nel dato grezzo dopo la cancellazione
     * dall'app Tuya.
     */
    return occurrences;
  }

  const plannedEvents =
    tuyaPrograms.flatMap((program) =>
      getTuyaOccurrences(program)
    );

  const todayKey =
    dateKey(new Date());

  return (
    <main
      style={{
        maxWidth: "1150px",
        margin: "0 auto",
        padding:
          "35px 20px 70px",
        fontFamily:
          "Arial, Helvetica, sans-serif",
      }}
    >
      <a
        href="/"
        style={{
          color: "#55745b",
          textDecoration: "none",
          fontWeight: "700",
        }}
      >
        ← Torna alla home
      </a>

      <header
        style={{
          marginTop: "25px",
          marginBottom: "25px",
        }}
      >
        <div
          style={{
            fontSize: "14px",
            fontWeight: "700",
            letterSpacing: "1.5px",
            color: "#55745b",
          }}
        >
          SISTEMA SMART TUYA
        </div>

        <h1
          style={{
            fontFamily:
              "Georgia, serif",
            fontSize: "42px",
            color: "#354d3b",
            margin:
              "8px 0",
          }}
        >
          💧 Irrigazione
        </h1>

        <p
          style={{
            color: "#68736b",
            fontSize: "17px",
            margin: 0,
          }}
        >
          Controllo reale del sistema
          di irrigazione del terrazzo.
        </p>
      </header>

      {statusError && (
        <div
          style={{
            padding: "14px 18px",
            borderRadius: "14px",
            background: "#fff0ed",
            color: "#b42318",
            marginBottom: "20px",
          }}
        >
          ⚠️ {statusError}
        </div>
      )}

      <section
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(250px, 1fr))",
          gap: "18px",
        }}
      >
        <div
          style={{
            padding: "24px",
            borderRadius: "22px",
            background:
              valveOn
                ? "#edf8ef"
                : "#f5f8f1",
            border:
              "1px solid #dfe8d8",
          }}
        >
          <div
            style={{
              color: "#68736b",
              fontSize: "13px",
              fontWeight: "700",
              letterSpacing: "1px",
            }}
          >
            STATO IRRIGAZIONE
          </div>

          <div
            style={{
              fontSize: "30px",
              fontWeight: "800",
              color:
                valveOn
                  ? "#2f6b3c"
                  : "#59645c",
              marginTop: "10px",
            }}
          >
            {loadingStatus
              ? "Caricamento..."
              : valveOn
              ? "🟢 ATTIVA"
              : "⚪ SPENTA"}
          </div>

          <div
            style={{
              marginTop: "8px",
              color: "#68736b",
            }}
          >
            Dispositivo: Irrigazione
          </div>

          <div
            style={{
              fontSize: "12px",
              color: "#8a918b",
              marginTop: "4px",
            }}
          >
            {DEVICE_ID}
          </div>
        </div>

        <div
          style={{
            padding: "24px",
            borderRadius: "22px",
            background: "#f5f8f1",
            border:
              "1px solid #dfe8d8",
          }}
        >
          <div
            style={{
              color: "#68736b",
              fontSize: "13px",
              fontWeight: "700",
            }}
          >
            BATTERIA
          </div>

          <div
            style={{
              fontSize: "30px",
              fontWeight: "800",
              color: "#354d3b",
              marginTop: "10px",
            }}
          >
            🔋{" "}
            {battery ??
              "—"}
            %
          </div>

          <div
            style={{
              marginTop: "8px",
              color: "#68736b",
            }}
          >
            Modalità:{" "}
            <strong>
              {workState ??
                "—"}
            </strong>
          </div>
        </div>

        <div
          style={{
            padding: "24px",
            borderRadius: "22px",
            background: "#f5f8f1",
            border:
              "1px solid #dfe8d8",
          }}
        >
          <div
            style={{
              color: "#68736b",
              fontSize: "13px",
              fontWeight: "700",
            }}
          >
            METEO / RAIN DELAY
          </div>

          <div
            style={{
              fontSize: "25px",
              fontWeight: "800",
              color: "#354d3b",
              marginTop: "10px",
            }}
          >
            {weather === "sunny"
              ? "☀️ Sereno"
              : weather || "—"}
          </div>

          <div
            style={{
              marginTop: "8px",
              color: "#68736b",
            }}
          >
            Rain delay:{" "}
            <strong>
              {rainDelay ?? 0}
            </strong>
          </div>
        </div>
      </section>

      <section
        style={{
          marginTop: "20px",
          padding: "25px",
          borderRadius: "24px",
          background: "#fffaf2",
          border:
            "1px solid #eadfca",
        }}
      >
        <h2
          style={{
            marginTop: 0,
            color: "#354d3b",
            fontFamily:
              "Georgia, serif",
          }}
        >
          🎛️ Controllo manuale
        </h2>

        <p
          style={{
            color: "#68736b",
          }}
        >
          Durata manuale impostata
          sul timer:{" "}
          <strong>
            {manualTime ?? "—"} minuti
          </strong>
        </p>

        <div
          style={{
            display: "flex",
            gap: "12px",
            flexWrap: "wrap",
            marginTop: "18px",
          }}
        >
          <button
            onClick={() =>
              setIrrigation(true)
            }
            disabled={
              switchLoading ||
              valveOn
            }
            style={{
              padding:
                "14px 22px",
              border: "none",
              borderRadius: "14px",
              background:
                "#55745b",
              color: "white",
              cursor:
                switchLoading ||
                valveOn
                  ? "default"
                  : "pointer",
              fontWeight: "800",
              opacity:
                switchLoading ||
                valveOn
                  ? 0.5
                  : 1,
            }}
          >
            💧 AVVIA IRRIGAZIONE
          </button>

          <button
            onClick={() =>
              setIrrigation(false)
            }
            disabled={
              switchLoading ||
              !valveOn
            }
            style={{
              padding:
                "14px 22px",
              border: "none",
              borderRadius: "14px",
              background:
                "#b42318",
              color: "white",
              cursor:
                switchLoading ||
                !valveOn
                  ? "default"
                  : "pointer",
              fontWeight: "800",
              opacity:
                switchLoading ||
                !valveOn
                  ? 0.5
                  : 1,
            }}
          >
            ⛔ FERMA IRRIGAZIONE
          </button>
        </div>
      </section>

      <section
        style={{
          marginTop: "25px",
          padding: "25px",
          borderRadius: "24px",
          background: "#f5f8f1",
          border:
            "1px solid #dfe8d8",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent:
              "space-between",
            gap: "15px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2
              style={{
                margin:
                  "0 0 5px",
                color: "#354d3b",
                fontFamily:
                  "Georgia, serif",
              }}
            >
              📅 Calendario irrigazione
            </h2>

            <p
              style={{
                margin: 0,
                color: "#68736b",
              }}
            >
              Storico delle irrigazioni
              effettuate e prossime
              programmate.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: "7px",
              alignItems: "center",
            }}
          >
            <button
              onClick={previousMonth}
              style={{
                border:
                  "1px solid #d5ddd1",
                background: "white",
                borderRadius:
                  "10px",
                padding:
                  "8px 12px",
                cursor: "pointer",
              }}
            >
              ←
            </button>

            <button
              onClick={goToday}
              style={{
                border:
                  "1px solid #d5ddd1",
                background: "white",
                borderRadius:
                  "10px",
                padding:
                  "8px 12px",
                cursor: "pointer",
                fontWeight: "700",
              }}
            >
              Oggi
            </button>

            <button
              onClick={nextMonth}
              style={{
                border:
                  "1px solid #d5ddd1",
                background: "white",
                borderRadius:
                  "10px",
                padding:
                  "8px 12px",
                cursor: "pointer",
              }}
            >
              →
            </button>
          </div>
        </div>

        <div
          style={{
            textAlign: "center",
            fontSize: "22px",
            fontWeight: "800",
            color: "#354d3b",
            margin:
              "22px 0 15px",
            textTransform:
              "capitalize",
          }}
        >
          {monthTitle(
            calendarMonth
          )}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(7, minmax(0, 1fr))",
            gap: "6px",
          }}
        >
          {[
            "Lun",
            "Mar",
            "Mer",
            "Gio",
            "Ven",
            "Sab",
            "Dom",
          ].map((day) => (
            <div
              key={day}
              style={{
                textAlign: "center",
                padding: "8px 2px",
                fontSize: "12px",
                fontWeight: "800",
                color: "#68736b",
              }}
            >
              {day}
            </div>
          ))}

          {calendarDays.map(
            (day, index) => {
              if (!day) {
                return (
                  <div
                    key={
                      "empty-" +
                      index
                    }
                  />
                );
              }

              const key = dateKey(
                new Date(
                  year,
                  month,
                  day
                )
              );

              const events =
                historyByDay[
                  key
                ] || [];

              const isToday =
                key === todayKey;

              const planned =
                plannedEvents.filter(
                  (event) =>
                    dateKey(
                      event.date
                    ) === key
                );

              return (
                <div
                  key={day}
                  style={{
                    minHeight:
                      "92px",
                    padding:
                      "8px",
                    borderRadius:
                      "12px",
                    background:
                      isToday
                        ? "#edf5e9"
                        : "white",
                    border:
                      isToday
                        ? "2px solid #55745b"
                        : "1px solid #dfe8d8",
                    boxSizing:
                      "border-box",
                  }}
                >
                  <div
                    style={{
                      fontWeight:
                        "800",
                      color:
                        "#354d3b",
                    }}
                  >
                    {day}
                  </div>

                  {events.map(
                    (event) => (
                      <div
                        key={
                          event.id
                        }
                        style={{
                          marginTop:
                            "5px",
                          padding:
                            "4px 5px",
                          borderRadius:
                            "7px",
                          background:
                            "#e8f2e6",
                          color:
                            "#35613c",
                          fontSize:
                            "11px",
                          fontWeight:
                            "700",
                        }}
                      >
                        💧{" "}
                        {formatTime(
                          event.date
                        )}
                      </div>
                    )
                  )}

                  {planned.map(
                    (
                      event,
                      plannedIndex
                    ) => (
                      <div
                        key={
                          "planned-" +
                          plannedIndex
                        }
                        style={{
                          marginTop:
                            "5px",
                          padding:
                            "4px 5px",
                          borderRadius:
                            "7px",
                          background:
                            "#e8eef8",
                          color:
                            "#365a82",
                          fontSize:
                            "11px",
                          fontWeight:
                            "700",
                        }}
                      >
                        🔵{" "}
                        {event.time}
                      </div>
                    )
                  )}
                </div>
              );
            }
          )}
        </div>

        <div
          style={{
            display: "flex",
            gap: "18px",
            flexWrap: "wrap",
            marginTop: "16px",
            color: "#68736b",
            fontSize: "13px",
          }}
        >
          <span>
            💧 Irrigazione effettuata
          </span>

          <span>
            🔵 Irrigazione prevista
          </span>
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
        <h2
          style={{
            marginTop: 0,
            color: "#354d3b",
            fontFamily:
              "Georgia, serif",
          }}
        >
          ⏱️ Programmazione Tuya
        </h2>

        <p
          style={{
            color: "#68736b",
          }}
        >
          Slot configurati nel
          dispositivo:{" "}
          <strong>
            {tuyaPrograms.filter(
              (program) => program.enabled
            ).length}
          </strong>
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "12px",
            marginTop: "15px",
          }}
        >
          {[
            ["Slot 1", "water_program1"],
            ["Slot 2", "water_program2"],
            ["Slot 3", "water_program3"],
            ["Slot 4", "water_program4"],
          ].map(
            ([label, code]) => (
              <div
                key={code}
                style={{
                  padding: "16px",
                  borderRadius:
                    "14px",
                  background:
                    "white",
                  border:
                    "1px solid #eadfca",
                }}
              >
                <strong>
                  {label}
                </strong>

                <div
                  style={{
                    marginTop:
                      "6px",
                    color:
                      "#68736b",
                    fontSize:
                      "13px",
                  }}
                >
                  {(() => {
                    const records =
                      tuyaPrograms.filter(
                        (program) =>
                          program.dp === code
                      );

                    if (records.length === 0) {
                      return statusMap[code] === "AA=="
                        ? "Non configurato"
                        : "Configurato";
                    }

                    return `${records.length} ${
                      records.length === 1
                        ? "irrigazione configurata"
                        : "irrigazioni configurate"
                    }`;
                  })()}
                </div>
              </div>
            )
          )}
        </div>

        <p
          style={{
            marginTop: "16px",
            fontSize: "13px",
            color: "#7a827a",
          }}
        >
          ℹ️ Il dispositivo contiene
          {tuyaPrograms.length} irrigazioni configurate
          attive riconosciute. Ora le
          colleghiamo al calendario.
        </p>
      </section>

      <section
        style={{
          marginTop: "25px",
        }}
      >
        <h2
          style={{
            color: "#354d3b",
            fontFamily:
              "Georgia, serif",
          }}
        >
          🌿 Registro annaffiature
          delle piante
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "16px",
          }}
        >
          {plants.map(
            (plant) => {
              const watered =
                lastWatered[
                  plant.name
                ];

              let wateredText =
                "";

              if (watered) {
                const date =
                  new Date(
                    watered
                  );

                const today =
                  new Date();

                const startToday =
                  new Date(
                    today.getFullYear(),
                    today.getMonth(),
                    today.getDate()
                  );

                const startWatered =
                  new Date(
                    date.getFullYear(),
                    date.getMonth(),
                    date.getDate()
                  );

                const days = Math.floor(
                  (
                    startToday -
                    startWatered
                  ) /
                    86400000
                );

                wateredText =
                  days === 0
                    ? "oggi"
                    : days === 1
                    ? "ieri"
                    : `${days} giorni fa`;
              }

              return (
                <article
                  key={
                    plant.name
                  }
                  style={{
                    background:
                      "#f5f8f1",
                    border:
                      "1px solid #dfe8d8",
                    borderRadius:
                      "18px",
                    padding:
                      "20px",
                  }}
                >
                  <div
                    style={{
                      fontSize:
                        "34px",
                    }}
                  >
                    {plant.icon}
                  </div>

                  <h3
                    style={{
                      color:
                        "#354d3b",
                      margin:
                        "8px 0",
                    }}
                  >
                    {plant.name}
                  </h3>

                  <p
                    style={{
                      color:
                        "#59645c",
                    }}
                  >
                    {plant.water}
                  </p>

                  {watered && (
                    <div
                      style={{
                        display:
                          "flex",
                        alignItems:
                          "center",
                        gap: "8px",
                        fontSize:
                          "13px",
                        color:
                          "#59645c",
                      }}
                    >
                      Ultima:
                      {" "}
                      {wateredText}

                      <button
                        onClick={() =>
                          eliminaUltimaAnnaffiatura(
                            plant.name
                          )
                        }
                        title="Cancella ultima annaffiatura"
                        style={{
                          border:
                            "none",
                          background:
                            "transparent",
                          color:
                            "#c62828",
                          cursor:
                            "pointer",
                          fontSize:
                            "17px",
                          fontWeight:
                            "800",
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  <button
                    onClick={() =>
                      annaffia(
                        plant.name
                      )
                    }
                    style={{
                      marginTop:
                        "12px",
                      padding:
                        "10px 16px",
                      border:
                        "none",
                      borderRadius:
                        "12px",
                      background:
                        "#55745b",
                      color:
                        "white",
                      cursor:
                        "pointer",
                      fontWeight:
                        "700",
                    }}
                  >
                    💧 Annaffiata oggi
                  </button>
                </article>
              );
            }
          )}
        </div>
      </section>
    </main>
  );
}
