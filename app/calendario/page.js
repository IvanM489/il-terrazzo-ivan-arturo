export default function Calendario() {
const mesi = [
"Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
"Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
];

const oggi = new Date();
const mese = oggi.getMonth();
const anno = oggi.getFullYear();

const primoGiorno = new Date(anno, mese, 1).getDay();
const giorniNelMese = new Date(anno, mese + 1, 0).getDate();

const offset = primoGiorno === 0 ? 6 : primoGiorno - 1;
const celle = [];

for (let i = 0; i < offset; i++) celle.push(null);
for (let giorno = 1; giorno <= giorniNelMese; giorno++) celle.push(giorno);

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
📅 Calendario
</h1>

<p style={{
color: "#6b756d",
fontSize: "18px",
marginBottom: "30px"
}}>
Le cure e le attività del nostro terrazzo.
</p>

<section style={{
background: "#f5f8f1",
border: "1px solid #dfe8d8",
borderRadius: "24px",
padding: "28px"
}}>
<h2 style={{
textAlign: "center",
color: "#354d3b",
marginBottom: "25px"
}}>
{mesi[mese]} {anno}
</h2>

<div style={{
display: "grid",
gridTemplateColumns: "repeat(7, 1fr)",
gap: "8px"
}}>
{["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map((giorno) => (
<div
key={giorno}
style={{
textAlign: "center",
fontWeight: "700",
color: "#55745b",
padding: "10px"
}}
>
{giorno}
</div>
))}

{celle.map((giorno, indice) => (
<div
key={indice}
style={{
minHeight: "75px",
background: giorno === oggi.getDate()
? "#e2efd9"
: "#ffffff",
border: "1px solid #dfe8d8",
borderRadius: "12px",
padding: "10px",
color: "#354d3b",
fontWeight: giorno === oggi.getDate() ? "700" : "400"
}}
>
{giorno && <div>{giorno}</div>}
</div>
))}
</div>
</section>
</main>
);
}
