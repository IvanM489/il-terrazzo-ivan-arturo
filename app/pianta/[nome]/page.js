import Link from "next/link";
import { plants } from "../../../data/plants";

export default async function PlantPage({ params }) {
const { nome } = await params;

const plant = plants.find(
(p) => p.name === decodeURIComponent(nome)
);

if (!plant) {
return (
<main style={{ padding: "40px" }}>
<h1>Pianta non trovata</h1>
<Link href="/piante">← Torna alle mie piante</Link>
</main>
);
}

const cardStyle = {
padding: "22px",
borderRadius: "20px",
background: "#f5f8f1",
border: "1px solid #dfe8d8",
};

return (
<main style={{
maxWidth: "1000px",
margin: "0 auto",
padding: "35px 20px"
}}>

<Link
href="/piante"
style={{
textDecoration: "none",
color: "#55745b",
fontWeight: "600"
}}
>
← Torna alle mie piante
</Link>

<section style={{
marginTop: "25px",
padding: "35px",
borderRadius: "28px",
background: "#f5f8f1",
border: "1px solid #dfe8d8"
}}>
<div style={{ fontSize: "64px" }}>{plant.icon}</div>
<h1>{plant.name}</h1>
<p><em>{plant.scientific}</em></p>
<p><strong>Categoria:</strong> {plant.category}</p>
</section>

<section style={{
display: "grid",
gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
gap: "18px",
marginTop: "25px"
}}>

<div style={cardStyle}>
<h2>☀️ Esposizione</h2>
<p>{plant.exposure}</p>
</div>

<div style={cardStyle}>
<h2>💧 Irrigazione</h2>
<p>{plant.water}</p>
</div>

<div style={cardStyle}>
<h2>🌿 Concimazione</h2>
<p>{plant.fertilizer}</p>
</div>

<div style={cardStyle}>
<h2>✂️ Potatura</h2>
<p>{plant.pruning}</p>
</div>

<div style={cardStyle}>
<h2>🐛 Problemi e malattie</h2>
<p>{plant.problems}</p>
</div>

<div style={cardStyle}>
<h2>📸 Fotografie</h2>
<p>Ancora nessuna fotografia.</p>
</div>

</section>

<section style={{
marginTop: "25px",
padding: "25px",
borderRadius: "24px",
background: "#fffaf2",
border: "1px solid #eadfca"
}}>
<h2>📝 Diario della pianta</h2>
<p>
Qui registreremo annaffiature, concimazioni,
potature, problemi e progressi della pianta.
</p>
</section>

</main>
);
}
