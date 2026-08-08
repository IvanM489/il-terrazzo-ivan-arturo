"use client";
"use client";
import { useState, useEffect } from "react";
import { plants } from "../../data/plants";

export default function Irrigazione() {
 const [lastWatered, setLastWatered] = useState({});
 useEffect(() => {
 const saved = window.localStorage.getItem("lastWatered");
 if (saved) setLastWatered(JSON.parse(saved));
 }, []);
 const annaffia = (name) => {
 const date = new Date().toISOString();
 const next = { ...lastWatered, [name]: date };

 setLastWatered(next);
 window.localStorage.setItem("lastWatered", JSON.stringify(next));

 const savedActions = window.localStorage.getItem("plantActions");
 const actions = savedActions ? JSON.parse(savedActions) : [];

 actions.push({
   date: date,
   type: "innaffiata",
   plant: name
 });

 window.localStorage.setItem("plantActions", JSON.stringify(actions));
 };
 return (
<main style={{
maxWidth: "1100px",
margin: "0 auto",
padding: "40px 24px",
fontFamily: "Georgia, serif"
}}>
<a
href="/"
style={{
color: "#55745b",
textDecoration: "none",
fontWeight: "600"
}}
>
← Torna alla home
</a>

<h1 style={{
fontSize: "42px",
color: "#354d3b",
marginTop: "30px",
marginBottom: "8px"
}}>
💧 Irrigazione
</h1>

<p style={{
color: "#6b756d",
fontSize: "18px",
marginBottom: "30px"
}}>
Controlliamo insieme le esigenze d'acqua delle nostre piante.
</p>

<section style={{
display: "grid",
gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
gap: "18px"
}}>
{plants.map((plant) => (
<article
key={plant.name}
style={{
background: "#f5f8f1",
border: "1px solid #dfe8d8",
borderRadius: "20px",
padding: "24px"
}}
>
<div style={{ fontSize: "36px" }}>
{plant.icon}
</div>

<h2 style={{
color: "#354d3b",
marginBottom: "8px"
}}>
{plant.name}
</h2>

<p>
<strong>Quando annaffiare</strong>
</p>

<p style={{ color: "#59645c" }}>
{plant.water}
</p>

{lastWatered[plant.name] && (() => { const d = new Date(lastWatered[plant.name]); const oggi = new Date(); const giorni = Math.floor((new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000); return <p style={{fontSize:"14px",color:"#59645c",marginTop:"10px"}}>Ultima annaffiatura: {giorni === 0 ? "oggi" : giorni === 1 ? "ieri" : `${giorni} giorni fa`}
<button
  onClick={() => {
    const next = { ...lastWatered };
    delete next[plant.name];
    setLastWatered(next);
    localStorage.setItem("lastWatered", JSON.stringify(next));

    const savedActions = localStorage.getItem("plantActions");
    const actions = savedActions ? JSON.parse(savedActions) : [];

    let removed = false;
    const filtered = actions.filter((action) => {
      if (
        !removed &&
        action.plant === plant.name &&
        action.type === "innaffiata"
      ) {
        removed = true;
        return false;
      }
      return true;
    });

    localStorage.setItem("plantActions", JSON.stringify(filtered));
  }}
  style={{ border: "none", background: "transparent", color: "#c62828", cursor: "pointer", fontSize: "18px", fontWeight: "700", padding: "0" }}
  title="Cancella ultima annaffiatura"
>
  ✕
</button></p>; })()}

<button onClick={() => annaffia(plant.name)} style={{marginTop:"12px",padding:"10px 16px",border:"none",borderRadius:"12px",background:"#55745b",color:"white",cursor:"pointer"}}>💧 Annaffiata oggi</button>

</article>
))}
</section>
</main>
);
}
