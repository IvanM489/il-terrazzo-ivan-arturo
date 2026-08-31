"use client";

import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";

const sections = [
  {
    icon: "🌿",
    title: "Piante del terrazzo",
    text: "Gestisci le tue piante",
    color: "green",
    href: "/piante",
  },
  {
    icon: "💧",
    title: "Irrigazione",
    text: "Controlla le annaffiature",
    color: "blue",
    href: "/irrigazione",
  },
  {
    icon: "📅",
    title: "Calendario",
    text: "Cure e attività",
    color: "orange",
    href: "/calendario",
  },
  {
    icon: "🪴",
    title: "Piante da interno",
    text: "Gestisci le piante di casa",
    color: "purple",
    href: "/piante-interne",
  },
  {
    icon: "🌳",
    title: "Bonsai",
    text: "Cura e coltiva i tuoi bonsai",
    color: "pink",
    href: "/bonsai",
  },
  {
    icon: "🔬",
    title: "Diagnosi AI",
    text: "Analizza la salute delle tue piante",
    color: "yellow",
    href: "/diagnosi-ai",
  },
];

export default function Home() {
  const [welcome, setWelcome] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showTasks, setShowTasks] = useState(false);
  const [completedTasks, setCompletedTasks] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [allPlants, setAllPlants] = useState([]);
  const [loadingUser, setLoadingUser] = useState(true);

  const oggi = new Date();
  const mese = oggi.getMonth();

  const stagione =
    mese === 11 || mese === 0 || mese === 1
      ? "inverno"
      : mese >= 2 && mese <= 4
        ? "primavera"
        : mese >= 5 && mese <= 7
          ? "estate"
          : "autunno";

  const periodoPotatura =
    mese === 1 ? "fine inverno" : stagione;

  useEffect(() => {
    async function loadPlantsForTasks() {
      try {
        const response = await fetch("/api/home/plants", {
          cache: "no-store",
        });

        if (!response.ok) {
          setAllPlants([]);
          return;
        }

        const result = await response.json();

        setAllPlants(result.plants || []);
      } catch {
        setAllPlants([]);
      }
    }

    loadPlantsForTasks();
  }, []);

  const tasks = allPlants.flatMap((plant) => {
    const result = [];

    const pruningSeasons = Array.isArray(plant.pruningSeason)
      ? plant.pruningSeason
      : [];

    const fertilizerSeasons = Array.isArray(plant.fertilizerSeason)
      ? plant.fertilizerSeason
      : [];

    if (
      pruningSeasons.includes(stagione) ||
      pruningSeasons.includes(periodoPotatura)
    ) {
      result.push({
        id: `potatura-${plant.collection}-${plant.id}-${stagione}-${oggi.getFullYear()}`,
        icon: "✂️",
        title: `Potatura ${plant.name}`,
        text: plant.pruning || "Potatura prevista.",
        type: "potatura",
        season: stagione,
        year: oggi.getFullYear(),
      });
    }

    if (fertilizerSeasons.includes(stagione)) {
      result.push({
        id: `concimazione-${plant.collection}-${plant.id}-${stagione}-${oggi.getFullYear()}`,
        icon: "🌿",
        title: `Concimazione ${plant.name}`,
        text: plant.fertilizer || "Concimazione prevista.",
        type: "concimazione",
        season: stagione,
        year: oggi.getFullYear(),
      });
    }

    return result;
  });

  useEffect(() => {
    const saved = localStorage.getItem("completedHomeTasks");

    if (saved) {
      try {
        setCompletedTasks(JSON.parse(saved));
      } catch {
        setCompletedTasks([]);
      }
    }
  }, []);

  useEffect(() => {
    const checkUser = async () => {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setIsAdmin(false);
        setLoadingUser(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("ruolo")
        .eq("id", user.id)
        .single();

      setIsAdmin(profile?.ruolo === "admin");
      setLoadingUser(false);
    };

    checkUser();
  }, []);

  const toggleTask = (id) => {
    const next = completedTasks.includes(id)
      ? completedTasks.filter((taskId) => taskId !== id)
      : [...completedTasks, id];

    setCompletedTasks(next);
    localStorage.setItem(
      "completedHomeTasks",
      JSON.stringify(next)
    );
  };

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const activeTasks = tasks.filter(
    (task) => !completedTasks.includes(task.id)
  );

  return (
    <>
      <main className="app">
        <header className="header">
          <div className="brand">
            <span className="brandIcon">🌿</span>

            <div>
              <h1>Il Terrazzo di Ivan & Arturo</h1>
              <p>Il nostro piccolo angolo verde.</p>
            </div>
          </div>

          <div className="headerActions">
            <div className="accountMenu">
              <button
                className="accountButton"
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label="Apri menu account"
                aria-expanded={menuOpen}
              >
                👤 Account
                <span className={`accountChevron ${menuOpen ? "open" : ""}`}>
                  ▾
                </span>
              </button>

              {menuOpen && (
                <>
                  <button
                    className="menuBackdrop"
                    aria-label="Chiudi menu"
                    onClick={() => setMenuOpen(false)}
                  />

                  <div className="accountDropdown">
                    <button
                      className="accountItem"
                      onClick={() => {
                        setMenuOpen(false);
                        window.location.href = "/profilo";
                      }}
                    >
                      <span>👤</span>
                      <span>Profilo</span>
                    </button>

                    {!loadingUser && isAdmin && (
                      <button
                        className="accountItem"
                        onClick={() => {
                          setMenuOpen(false);
                          window.location.href = "/admin";
                        }}
                      >
                        <span>⚙️</span>
                        <span>Amministrazione</span>
                      </button>
                    )}

                    <div className="accountDivider" />

                    <button
                      className="accountItem logoutItem"
                      onClick={logout}
                    >
                      <span>↪</span>
                      <span>Esci</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {welcome && (
          <section className="welcome">
            <div>
              <span className="eyebrow">BENVENUTI A CASA</span>

              <h2>
                Prendiamoci cura
                <br />
                del nostro terrazzo.
              </h2>

              <p>
                Tutte le nostre piante, le loro cure,
                le fotografie e i ricordi in un unico posto.
              </p>
            </div>

            <div className="welcomePlant">🪴</div>
          </section>
        )}

        <section className="today">
          <div className="todayHeader">
            <div>
              <span className="eyebrow">OGGI</span>

              <h2>
                Il terrazzo ha bisogno di te
              </h2>
            </div>

            <div className="taskCount">
              {activeTasks.length}
              <span>
                {activeTasks.length === 1
                  ? " attività"
                  : " attività"}
              </span>
            </div>
          </div>
        </section>

        {showTasks && (
          <section className="tasksPanel">
            <div className="tasksHeader">
              <div>
                <span className="eyebrow">PROMEMORIA</span>

                <h2>🌱 Cose imminenti da fare</h2>

                <p>
                  Attività consigliate per la stagione:
                  <strong> {stagione}</strong>
                </p>
              </div>

              <button
                className="closeTasks"
                onClick={() => setShowTasks(false)}
                aria-label="Chiudi promemoria"
              >
                ✕
              </button>
            </div>

            <div className="taskList">
              {activeTasks.map((task) => (
                <button
                  className="taskCheck"
                  key={task.id}
                  onClick={() => toggleTask(task.id)}
                  aria-label={`Segna come completata: ${task.title}`}
                >
                  <span className="checkbox">☐</span>

                  <span className="taskContent">
                    <strong>
                      {task.icon} {task.title}
                    </strong>

                    <span>{task.text}</span>
                  </span>
                </button>
              ))}

              {activeTasks.length === 0 && (
                <div className="allDone">
                  ✨ Tutto fatto!
                  <span>
                    Nessuna attività da completare.
                  </span>
                </div>
              )}
            </div>
          </section>
        )}

        {!showTasks && (
          <button
            className="showTasks"
            onClick={() => setShowTasks(true)}
          >
            🌱 Mostra promemoria
          </button>
        )}

        <section className="cards">
          {sections.map((section) => (
            <button
              className={`card ${section.color}`}
              key={section.title}
              onClick={() => {
                if (section.href === "#") {
                  alert(
                    `${section.title}: sezione in costruzione 🌱`
                  );
                  return;
                }

                window.location.href = section.href;
              }}
            >
              <span className="cardIcon">
                {section.icon}
              </span>

              <span className="cardTitle">
                {section.title}
              </span>

              <span className="cardText">
                {section.text}
              </span>

              <span className="arrow">›</span>
            </button>
          ))}
        </section>

        <section className="quote">
          <span>🌱</span>

          <p>
            “Un terrazzo non è solo uno spazio:
            è qualcosa che cresce insieme a noi.”
          </p>
        </section>

        <footer>
          <span>Il Terrazzo di Ivan & Arturo</span>
          <span>v0.1 · In sviluppo</span>
        </footer>
      </main>

      <style jsx>{`
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          background: #f4f6f1;
          color: #263126;
          font-family: Arial, Helvetica, sans-serif;
        }

        button {
          font: inherit;
        }

        .app {
          min-height: 100vh;
          max-width: 1100px;
          margin: 0 auto;
          padding: 28px 24px 40px;
        }

        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 28px;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .brandIcon {
          font-size: 42px;
        }

        .brand h1 {
          margin: 0;
          color: #354d3b;
          font-size: 25px;
        }

        .brand p {
          margin: 5px 0 0;
          color: #687168;
        }

        .headerActions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .profile,
        .profileButton,
        .adminButton,
        .logoutButton {
          border: 1px solid #d9e0d5;
          background: #fffdf8;
          color: #354d3b;
          border-radius: 14px;
          cursor: pointer;
          font-weight: 700;
        }

        .profile {
          width: 48px;
          height: 48px;
        }

        .profileButton {
          height: 48px;
          padding: 0 15px;
        }

        .adminButton {
          padding: 12px 15px;
        }

        .logoutButton {
          width: 48px;
          height: 48px;
          font-size: 21px;
        }

        .adminButton:hover,
        .logoutButton:hover,
        .profile:hover,
        .profileButton:hover {
          background: #edf3e9;
        }

        .accountMenu {
          position: relative;
        }

        .accountButton {
          height: 48px;
          display: flex;
          align-items: center;
          gap: 8px;
          border: 1px solid #d9e0d5;
          background: #fffdf8;
          color: #354d3b;
          border-radius: 14px;
          padding: 0 14px;
          cursor: pointer;
          font-weight: 700;
          white-space: nowrap;
          transition: background 0.15s ease;
        }

        .accountButton:hover {
          background: #edf3e9;
        }

        .accountChevron {
          display: inline-block;
          font-size: 16px;
          transition: transform 0.15s ease;
        }

        .accountChevron.open {
          transform: rotate(180deg);
        }

        .menuBackdrop {
          position: fixed;
          inset: 0;
          z-index: 90;
          border: none;
          background: transparent;
          cursor: default;
        }

        .accountDropdown {
          position: absolute;
          top: calc(100% + 9px);
          right: 0;
          z-index: 100;
          width: 215px;
          padding: 8px;
          background: #fffdf8;
          border: 1px solid #e0e4dc;
          border-radius: 17px;
          box-shadow: 0 12px 30px rgba(50, 70, 50, 0.14);
        }

        .accountItem {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 11px;
          border: none;
          background: transparent;
          color: #354d3b;
          border-radius: 11px;
          padding: 11px 12px;
          cursor: pointer;
          text-align: left;
          font-weight: 700;
        }

        .accountItem:hover {
          background: #edf3e9;
        }

        .accountItem span:first-child {
          width: 22px;
          text-align: center;
          font-size: 17px;
        }

        .accountDivider {
          height: 1px;
          margin: 7px 5px;
          background: #e6e9e3;
        }

        .logoutItem {
          color: #7d5149;
        }

        .logoutItem:hover {
          background: #f8eeeb;
        }

        .welcome {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 30px;
          padding: 30px;
          border-radius: 26px;
          background: #e9f1e5;
          margin-bottom: 28px;
        }

        .eyebrow {
          display: block;
          color: #55745b;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 1.4px;
        }

        .welcome h2 {
          margin: 8px 0 10px;
          color: #354d3b;
          font-size: 32px;
          line-height: 1.15;
        }

        .welcome p {
          margin: 0;
          color: #687168;
          line-height: 1.6;
        }

        .welcomePlant {
          font-size: 74px;
        }

        .today {
          margin: 10px 0 0;
        }

        .todayHeader {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
        }

        .today h2 {
          margin: 7px 0 0;
          color: #354d3b;
          font-size: 27px;
        }

        .taskCount {
          color: #354d3b;
          font-size: 30px;
          font-weight: 800;
          text-align: right;
        }

        .taskCount span {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: #687168;
        }

        .tasksPanel {
          margin-top: 24px;
          padding: 24px;
          background: #fffdf8;
          border: 1px solid #e8dfcf;
          border-radius: 24px;
          box-shadow: 0 8px 24px rgba(50, 70, 50, 0.06);
        }

        .tasksHeader {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          margin-bottom: 18px;
        }

        .tasksHeader h2 {
          margin: 6px 0;
          font-size: 23px;
          color: #354d3b;
        }

        .tasksHeader p {
          margin: 0;
          color: #687168;
          font-size: 14px;
        }

        .closeTasks {
          border: none;
          background: #f1eee6;
          color: #687168;
          width: 38px;
          height: 38px;
          border-radius: 50%;
          cursor: pointer;
        }

        .taskList {
          display: grid;
          gap: 10px;
        }

        .taskCheck {
          width: 100%;
          display: flex;
          align-items: flex-start;
          gap: 13px;
          text-align: left;
          border: 1px solid #e8dfcf;
          background: #fafbf7;
          border-radius: 15px;
          padding: 15px;
          cursor: pointer;
          color: #354d3b;
        }

        .taskCheck:hover {
          background: #f1f6ed;
        }

        .checkbox {
          font-size: 22px;
          line-height: 1;
        }

        .taskContent {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .taskContent strong {
          font-size: 15px;
        }

        .taskContent span {
          color: #687168;
          font-size: 13px;
          line-height: 1.45;
        }

        .allDone {
          text-align: center;
          padding: 25px;
          color: #55745b;
          font-weight: 700;
        }

        .allDone span {
          display: block;
          margin-top: 5px;
          color: #687168;
          font-size: 14px;
          font-weight: 400;
        }

        .showTasks {
          margin-top: 20px;
          border: none;
          background: #e9f1e5;
          color: #55745b;
          border-radius: 14px;
          padding: 11px 16px;
          cursor: pointer;
          font-weight: 700;
        }

        .cards {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-top: 28px;
        }

        .card {
          position: relative;
          min-height: 165px;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          justify-content: flex-start;
          text-align: left;
          padding: 23px;
          border: 1px solid transparent;
          border-radius: 22px;
          cursor: pointer;
          transition: transform 0.15s ease;
        }

        .card:hover {
          transform: translateY(-2px);
        }

        .cardIcon {
          font-size: 34px;
          margin-bottom: 14px;
        }

        .cardTitle {
          color: #354d3b;
          font-size: 18px;
          font-weight: 800;
        }

        .cardText {
          margin-top: 6px;
          color: #687168;
          font-size: 14px;
          line-height: 1.4;
        }

        .arrow {
          position: absolute;
          right: 19px;
          bottom: 17px;
          color: #55745b;
          font-size: 25px;
        }

        .green {
          background: #e9f1e5;
          border-color: #d8e6d2;
        }

        .blue {
          background: #e9f2f5;
          border-color: #d5e5ea;
        }

        .orange {
          background: #f7efe3;
          border-color: #eadcca;
        }

        .purple {
          background: #f0ebf5;
          border-color: #e1d8eb;
        }

        .pink {
          background: #f5e9ed;
          border-color: #ead7de;
        }

        .yellow {
          background: #f5f1df;
          border-color: #e9e1c6;
        }

        .quote {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin: 34px 0 25px;
          padding: 25px;
          color: #55745b;
          text-align: center;
        }

        .quote span {
          font-size: 25px;
        }

        .quote p {
          margin: 0;
          font-style: italic;
        }

        footer {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          padding-top: 20px;
          border-top: 1px solid #dde2d9;
          color: #7b837c;
          font-size: 12px;
        }

        @media (max-width: 800px) {
          .cards {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 560px) {
          .app {
            padding: 20px 15px 30px;
          }

          .header {
            align-items: flex-start;
          }

          .brand h1 {
            font-size: 19px;
          }

          .brand p {
            font-size: 13px;
          }

          .brandIcon {
            font-size: 32px;
          }

          .headerActions {
            flex-shrink: 0;
          }

          .accountButton {
            height: 44px;
            padding: 0 11px;
            font-size: 13px;
          }

          .accountDropdown {
            right: 0;
            width: 205px;
          }

          .welcome {
            padding: 22px;
          }

          .welcome h2 {
            font-size: 26px;
          }

          .welcomePlant {
            display: none;
          }

          .todayHeader {
            align-items: flex-end;
          }

          .cards {
            grid-template-columns: 1fr;
          }

          .tasksPanel {
            padding: 18px;
          }

          footer {
            flex-direction: column;
          }
        }
      `}</style>
    </>
  );
}
