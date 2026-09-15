"use client";

import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";

const sections = [
  { icon: "🌿", title: "Piante del terrazzo", text: "Gestisci le tue piante", color: "green", href: "/piante" },
  { icon: "🪴", title: "Piante da interno", text: "Gestisci le piante di casa", color: "purple", href: "/piante-interne" },
  { icon: "🌳", title: "Bonsai", text: "Cura e coltiva i tuoi bonsai", color: "pink", href: "/bonsai" },
  { icon: "💧", title: "Irrigazione", text: "Controlla le annaffiature", color: "blue", href: "/irrigazione" },
  { icon: "📅", title: "Calendario", text: "Potatura e concimazione di tutte le piante. Irrigazione piante da interno e bonsai", color: "orange", href: "/calendario" },
  { icon: "🔬", title: "Diagnosi AI", text: "Analizza la salute delle tue piante", color: "yellow", href: "/diagnosi-ai" },
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
  const stagione = mese === 11 || mese === 0 || mese === 1 ? "inverno" : mese >= 2 && mese <= 4 ? "primavera" : mese >= 5 && mese <= 7 ? "estate" : "autunno";
  const periodoPotatura = mese === 1 ? "fine inverno" : stagione;

  useEffect(() => {
    async function loadPlantsForTasks() {
      try {
        const response = await fetch("/api/home/plants", { cache: "no-store" });
        if (!response.ok) { setAllPlants([]); return; }
        const result = await response.json();
        setAllPlants(result.plants || []);
      } catch { setAllPlants([]); }
    }
    loadPlantsForTasks();
  }, []);

  const tasks = allPlants.flatMap((plant) => {
    const result = [];
    const pruningSeasons = Array.isArray(plant.pruningSeason) ? plant.pruningSeason : [];
    const fertilizerSeasons = Array.isArray(plant.fertilizerSeason) ? plant.fertilizerSeason : [];
    if (pruningSeasons.includes(stagione) || pruningSeasons.includes(periodoPotatura)) result.push({ id: `potatura-${plant.collection}-${plant.id}-${stagione}-${oggi.getFullYear()}`, icon: "✂️", title: `Potatura ${plant.name}`, text: plant.pruning || "Potatura prevista.", type: "potatura", season: stagione, year: oggi.getFullYear() });
    if (fertilizerSeasons.includes(stagione)) result.push({ id: `concimazione-${plant.collection}-${plant.id}-${stagione}-${oggi.getFullYear()}`, icon: "🌿", title: `Concimazione ${plant.name}`, text: plant.fertilizer || "Concimazione prevista.", type: "concimazione", season: stagione, year: oggi.getFullYear() });
    return result;
  });

  useEffect(() => {
    const saved = localStorage.getItem("completedHomeTasks");
    if (saved) { try { setCompletedTasks(JSON.parse(saved)); } catch { setCompletedTasks([]); } }
  }, []);

  useEffect(() => {
    const checkUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setIsAdmin(false); setLoadingUser(false); return; }
      const { data: profile } = await supabase.from("profiles").select("ruolo").eq("id", user.id).single();
      setIsAdmin(profile?.ruolo === "admin");
      setLoadingUser(false);
    };
    checkUser();
  }, []);

  const toggleTask = (id) => {
    const next = completedTasks.includes(id) ? completedTasks.filter((taskId) => taskId !== id) : [...completedTasks, id];
    setCompletedTasks(next);
    localStorage.setItem("completedHomeTasks", JSON.stringify(next));
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/login";
    }
  };

  const activeTasks = tasks.filter((task) => !completedTasks.includes(task.id));

  return (
    <>
      <main className="app">
        <header className="header">
          <div className="brand"><span className="brandIcon">🌿</span><div><h1>Il Terrazzo di Ivan & Arturo</h1><p>Il nostro piccolo angolo verde.</p></div></div>
          <div className="headerActions"><div className="accountMenu"><button className="accountButton" onClick={() => setMenuOpen(!menuOpen)} aria-label="Apri menu account" aria-expanded={menuOpen}>👤 Account <span className={`accountChevron ${menuOpen ? "open" : ""}`}>▾</span></button>{menuOpen && <><button className="menuBackdrop" aria-label="Chiudi menu" onClick={() => setMenuOpen(false)} /><div className="accountDropdown"><button className="accountItem" onClick={() => { setMenuOpen(false); window.location.href = "/profilo"; }}><span>👤</span><span>Profilo</span></button>{!loadingUser && isAdmin && <button className="accountItem" onClick={() => { setMenuOpen(false); window.location.href = "/admin"; }}><span>⚙️</span><span>Amministrazione</span></button>}<div className="accountDivider" /><button className="accountItem logoutItem" onClick={logout}><span>↪</span><span>Esci</span></button></div></>}</div></div>
        </header>

        {welcome && <section className="welcome"><div><span className="eyebrow">BENVENUTI A CASA</span><h2>Prendiamoci cura<br />del nostro terrazzo.</h2><p>Tutte le nostre piante, le loro cure,<br />le fotografie e i ricordi in un unico posto.</p></div><div className="welcomePlant">🪴</div></section>}
        <section className="today"><div className="todayHeader"><div><span className="eyebrow">OGGI</span><h2>Il terrazzo ha bisogno di te</h2></div><div className="taskCount">{activeTasks.length}<span>{activeTasks.length === 1 ? " attività" : " attività"}</span></div></div></section>
        {showTasks && <section className="tasksPanel"><div className="tasksHeader"><div><span className="eyebrow">PROMEMORIA</span><h2>🌱 Cose imminenti da fare</h2><p>Attività consigliate per la stagione:<strong> {stagione}</strong></p></div><button className="closeTasks" onClick={() => setShowTasks(false)} aria-label="Chiudi promemoria">✕</button></div><div className="taskList">{activeTasks.map((task) => <button className="taskCheck" key={task.id} onClick={() => toggleTask(task.id)} aria-label={`Segna come completata: ${task.title}`}><span className="checkbox">☐</span><span className="taskContent"><strong>{task.icon} {task.title}</strong><span>{task.text}</span></span></button>)}{activeTasks.length === 0 && <div className="allDone">✨ Tutto fatto!<span>Nessuna attività da completare.</span></div>}</div></section>}
        {!showTasks && <button className="showTasks" onClick={() => setShowTasks(true)}>🌱 Mostra promemoria</button>}
        <section className="cards">{sections.map((section) => <button className={`card ${section.color}`} key={section.title} onClick={() => { if (section.href === "#") { alert(`${section.title}: sezione in costruzione 🌱`); return; } window.location.href = section.href; }}><span className="cardIcon">{section.icon}</span><span className="cardTitle">{section.title}</span><span className="cardText">{section.text}</span><span className="arrow">›</span></button>)}</section>
        <section className="quote"><span>🌱</span><p>“Un terrazzo non è solo uno spazio: è qualcosa che cresce insieme a noi.”</p></section>
        <footer><span>Il Terrazzo di Ivan & Arturo</span><span>v0.1 · In sviluppo</span></footer>
      </main>
      <style jsx>{`*{box-sizing:border-box}body{margin:0;background:#f4f6f1;color:#263126;font-family:Arial,Helvetica,sans-serif}button{font:inherit}.app{min-height:100vh;max-width:1100px;margin:0 auto;padding:28px 24px 40px}.header{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:28px}.brand{display:flex;align-items:center;gap:14px}.brandIcon{font-size:42px}.brand h1{margin:0;color:#354d3b;font-size:25px}.brand p{margin:5px 0 0;color:#687168}.headerActions{display:flex;align-items:center;gap:8px}.accountMenu{position:relative}.accountButton{height:48px;display:flex;align-items:center;gap:8px;border:1px solid #d9e0d5;background:#fffdf8;color:#354d3b;border-radius:14px;padding:0 14px;cursor:pointer;font-weight:700;white-space:nowrap;transition:background .15s ease}.accountButton:hover{background:#edf3e9}.accountChevron{display:inline-block;font-size:16px;transition:transform .15s ease}.accountChevron.open{transform:rotate(180deg)}.menuBackdrop{position:fixed;inset:0;z-index:90;border:none;background:transparent;cursor:default}.accountDropdown{position:absolute;top:calc(100% + 9px);right:0;z-index:100;width:215px;padding:8px;background:#fffdf8;border:1px solid #e0e4dc;border-radius:17px;box-shadow:0 12px 30px rgba(50,70,50,.14)}.accountItem{width:100%;display:flex;align-items:center;gap:11px;border:0;background:transparent;color:#354d3b;padding:11px 10px;border-radius:10px;cursor:pointer;text-align:left;font-weight:600}.accountItem:hover{background:#edf3e9}.accountDivider{height:1px;background:#e5e8e1;margin:5px 4px}.logoutItem{color:#a33a32}.welcome{display:flex;align-items:center;justify-content:space-between;gap:25px;padding:36px 38px;margin-bottom:25px;background:#e8efe2;border-radius:28px}.eyebrow{display:block;color:#55745b;font-size:12px;font-weight:800;letter-spacing:1.7px}.welcome h2{font-family:Georgia,serif;font-size:40px;line-height:1.08;margin:10px 0 14px;color:#354d3b}.welcome p{color:#687168;font-size:17px;line-height:1.55;margin:0}.welcomePlant{font-size:100px}.today{background:#fffdf8;border:1px solid #e0e4dc;border-radius:25px;padding:24px 28px;margin-bottom:16px}.todayHeader{display:flex;align-items:center;justify-content:space-between;gap:20px}.today h2{font-family:Georgia,serif;color:#354d3b;font-size:27px;margin:7px 0 0}.taskCount{font-size:34px;font-weight:800;color:#55745b;text-align:right}.taskCount span{display:block;font-size:13px;color:#687168;font-weight:600}.showTasks{display:block;width:100%;border:1px solid #d9e0d5;background:#edf3e9;color:#55745b;border-radius:15px;padding:13px;font-weight:700;cursor:pointer;margin-bottom:22px}.tasksPanel{background:#fffdf8;border:1px solid #e0e4dc;border-radius:25px;padding:25px 28px;margin-bottom:22px}.tasksHeader{display:flex;justify-content:space-between;gap:15px}.tasksHeader h2{font-family:Georgia,serif;margin:8px 0;color:#354d3b}.tasksHeader p{color:#687168;margin:0}.closeTasks{border:0;background:transparent;font-size:20px;cursor:pointer;color:#687168}.taskList{margin-top:20px;display:grid;gap:8px}.taskCheck{display:flex;align-items:flex-start;gap:13px;width:100%;padding:13px;border:1px solid #e0e4dc;background:#f8faf5;border-radius:13px;text-align:left;cursor:pointer;color:#354d3b}.checkbox{font-size:22px}.taskContent{display:flex;flex-direction:column;gap:4px}.taskContent span{color:#687168;font-size:14px;line-height:1.4}.allDone{display:flex;flex-direction:column;gap:5px;color:#55745b;font-weight:800}.allDone span{color:#687168;font-weight:400}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.card{position:relative;display:flex;flex-direction:column;align-items:flex-start;min-height:165px;padding:24px;border:1px solid #e0e4dc;border-radius:22px;text-align:left;cursor:pointer;transition:transform .15s ease,box-shadow .15s ease}.card:hover{transform:translateY(-2px);box-shadow:0 10px 24px rgba(50,70,50,.08)}.cardIcon{font-size:35px;margin-bottom:18px}.cardTitle{font-family:Georgia,serif;font-size:21px;font-weight:700;color:#354d3b}.cardText{margin-top:7px;color:#687168;font-size:14px;line-height:1.4;padding-right:18px}.arrow{position:absolute;right:18px;bottom:18px;font-size:28px;color:#55745b}.green{background:#eef5ea}.blue{background:#edf5f7}.orange{background:#fbf1e7}.purple{background:#f3eef7}.pink{background:#f7eef0}.yellow{background:#f7f5e8}.quote{display:flex;align-items:center;justify-content:center;gap:12px;margin:38px 0 25px;color:#718071}.quote span{font-size:25px}.quote p{font-family:Georgia,serif;font-style:italic;text-align:center;margin:0}.app footer{display:flex;justify-content:space-between;color:#98a198;font-size:12px;padding-top:20px;border-top:1px solid #dde2da}@media(max-width:760px){.app{padding:20px 15px 30px}.brandIcon{font-size:34px}.brand h1{font-size:20px}.brand p{font-size:13px}.header{margin-bottom:20px}.welcome{padding:27px 23px}.welcome h2{font-size:31px}.welcome p{font-size:15px}.welcomePlant{font-size:70px}.cards{grid-template-columns:1fr}.card{min-height:140px}.today{padding:20px}.today h2{font-size:23px}.taskCount{font-size:28px}.accountButton{height:44px}.app footer{flex-direction:column;gap:6px}}@media(max-width:500px){.header{align-items:flex-start}.brand p{display:none}.welcomePlant{font-size:58px}.welcome{gap:8px}.cardText{max-width:85%}}`}</style>
    </>
  );
}
