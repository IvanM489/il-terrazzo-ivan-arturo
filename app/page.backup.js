"use client";

import { useState } from "react";

const sections = [
{ icon: "🌿", title: "Le mie piante", text: "Gestisci le tue piante", color: "green" },
{ icon: "💧", title: "Irrigazione", text: "Controlla le annaffiature", color: "blue" },
{ icon: "📅", title: "Calendario", text: "Cure e attività", color: "orange" },
{ icon: "📔", title: "Diario", text: "Racconta la vita del terrazzo", color: "purple" },
{ icon: "📷", title: "Fotografie", text: "Memorie e progressi", color: "pink" },
{ icon: "☀️", title: "Condizioni", text: "Meteo e ambiente", color: "yellow" },
];

export default function Home() {
const [welcome, setWelcome] = useState(true);

return (
<>
<main className="app">
<header className="header">
<div className="brand">
<div className="logo">🌿</div>
<div>
<h1>Il Terrazzo di Ivan & Arturo</h1>
<p>Il nostro piccolo angolo verde.</p>
</div>
</div>

<button
className="profile"
onClick={() => setWelcome(!welcome)}
aria-label="Profilo"
>
I&A
</button>
</header>

{welcome && (
<section className="welcome">
<div>
<span className="eyebrow">BENVENUTI A CASA</span>
<h2>Prendiamoci cura<br />del nostro terrazzo.</h2>
<p>
Tutte le nostre piante, le loro cure, le fotografie
e i ricordi in un unico posto.
</p>
</div>
<div className="welcomePlant">🪴</div>
</section>
)}

<section className="today">
<div>
<span className="eyebrow">OGGI</span>
<h3>Il terrazzo ha bisogno di te</h3>
</div>
<div className="todayBadge">0 attività</div>
</section>

<section className="grid">
{sections.map((section) => (
<button
className={`card ${section.color}`}
key={section.title}
 onClick={() => section.title === "Calendario" ? window.location.href = "/calendario" : section.title === "Irrigazione" ? window.location.href = "/irrigazione" : section.title === "Le mie piante" ? window.location.href = "/piante" : alert(`${section.title}: sezione in costruzione 🌱`)}
>
<div className="cardIcon">{section.icon}</div>
<div className="cardText">
<h3>{section.title}</h3>
<p>{section.text}</p>
</div>
<span className="arrow">›</span>
</button>
))}
</section>

<section className="quote">
<span>🌱</span>
<p>
“Un terrazzo non è solo uno spazio: è qualcosa che cresce insieme a noi.”
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
padding: 34px 28px 30px;
}

.header {
display: flex;
align-items: center;
justify-content: space-between;
margin-bottom: 30px;
}

.brand {
display: flex;
align-items: center;
gap: 15px;
}

.logo {
width: 58px;
height: 58px;
border-radius: 18px;
display: grid;
place-items: center;
background: #dcebd9;
font-size: 30px;
}

.brand h1 {
margin: 0;
font-size: 25px;
letter-spacing: -0.5px;
}

.brand p {
margin: 5px 0 0;
color: #71806f;
font-size: 14px;
}

.profile {
width: 48px;
height: 48px;
border: 0;
border-radius: 50%;
background: #2f4934;
color: white;
font-size: 13px;
font-weight: bold;
cursor: pointer;
}

.welcome {
min-height: 270px;
padding: 42px 45px;
border-radius: 30px;
background: linear-gradient(120deg, #dcebd9, #eef3e8);
display: flex;
align-items: center;
justify-content: space-between;
overflow: hidden;
margin-bottom: 28px;
}

.eyebrow {
font-size: 11px;
font-weight: 800;
letter-spacing: 1.6px;
color: #668064;
}

.welcome h2 {
margin: 12px 0;
font-size: clamp(32px, 5vw, 52px);
line-height: 1.02;
letter-spacing: -2px;
color: #29402d;
}

.welcome p {
max-width: 530px;
margin: 0;
color: #647064;
line-height: 1.6;
font-size: 15px;
}

.welcomePlant {
font-size: 120px;
transform: rotate(-5deg);
padding-right: 25px;
}

.today {
display: flex;
justify-content: space-between;
align-items: center;
margin: 10px 3px 16px;
}

.today h3 {
margin: 6px 0 0;
font-size: 20px;
}

.todayBadge {
padding: 9px 15px;
border-radius: 30px;
background: white;
color: #71806f;
font-size: 13px;
box-shadow: 0 3px 15px rgba(35, 55, 35, 0.06);
}

.grid {
display: grid;
grid-template-columns: repeat(3, 1fr);
gap: 15px;
}

.card {
min-height: 145px;
padding: 23px;
border: 1px solid rgba(0,0,0,0.04);
border-radius: 23px;
text-align: left;
cursor: pointer;
display: flex;
flex-direction: column;
justify-content: space-between;
position: relative;
transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.card:hover {
transform: translateY(-3px);
box-shadow: 0 12px 28px rgba(35, 55, 35, 0.10);
}

.green { background: #e3f0df; }
.blue { background: #e0edf3; }
.orange { background: #f5ead8; }
.purple { background: #ebe4f2; }
.pink { background: #f3e3e3; }
.yellow { background: #f2efd8; }

.cardIcon {
font-size: 29px;
}

.cardText h3 {
margin: 10px 0 4px;
font-size: 18px;
color: #29352b;
}

.cardText p {
margin: 0;
color: #758075;
font-size: 13px;
}

.arrow {
position: absolute;
right: 20px;
bottom: 17px;
font-size: 25px;
color: #879287;
}

.quote {
margin-top: 28px;
padding: 22px 25px;
border-radius: 20px;
background: white;
display: flex;
gap: 14px;
align-items: center;
color: #687368;
box-shadow: 0 3px 15px rgba(35, 55, 35, 0.05);
}

.quote span {
font-size: 25px;
}

.quote p {
margin: 0;
font-size: 14px;
font-style: italic;
}

footer {
display: flex;
justify-content: space-between;
margin-top: 28px;
padding: 0 4px;
color: #929a91;
font-size: 11px;
}

@media (max-width: 700px) {
.app {
padding: 20px 16px 25px;
}

.brand h1 {
font-size: 19px;
}

.brand p {
font-size: 12px;
}

.logo {
width: 48px;
height: 48px;
font-size: 25px;
}

.welcome {
min-height: 290px;
padding: 30px 25px;
border-radius: 25px;
}

.welcomePlant {
position: absolute;
right: 5px;
margin-top: 150px;
font-size: 80px;
opacity: 0.7;
}

.grid {
grid-template-columns: 1fr 1fr;
gap: 11px;
}

.card {
min-height: 145px;
padding: 18px;
}

.cardText h3 {
font-size: 16px;
}

.today h3 {
font-size: 17px;
}

footer {
flex-direction: column;
gap: 5px;
}
}
`}</style>
</>
);
}