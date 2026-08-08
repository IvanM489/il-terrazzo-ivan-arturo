import Link from "next/link";
const plants = [
{
name: "Rincospermo",
scientific: "Trachelospermum jasminoides",
icon: "🌿",
exposure: "Sole o mezz'ombra",
water: "Regolare, più frequente in estate",
category: "Rampicante",
},
{
name: "Sophora japonica 'Pendula'",
scientific: "Styphnolobium japonicum 'Pendulum'",
icon: "🌳",
exposure: "Sole",
water: "Moderata, regolare nei periodi caldi",
category: "Albero ornamentale",
},
{
name: "Melo da fiore",
scientific: "Malus",
icon: "🌸",
exposure: "Sole o mezz'ombra",
water: "Regolare, evitando ristagni",
category: "Albero ornamentale",
},
{
name: "Bambù",
scientific: "Bambusoideae",
icon: "🎋",
exposure: "Sole o mezz'ombra",
water: "Regolare, più frequente in estate",
category: "Sempreverde",
},
{
name: "Azalea",
scientific: "Rhododendron",
icon: "🌺",
exposure: "Mezz'ombra luminosa",
water: "Regolare, terreno sempre leggermente umido",
category: "Fiorita",
},
];

export default function PlantsPage() {
return (
<main style={{ padding: "32px", maxWidth: "1100px", margin: "0 auto" }}>
      <Link href="/" style={{ textDecoration: "none", color: "#55745b", fontWeight: "600" }}>← Torna alla Home</Link>
<h1>🌿 Le mie piante</h1>
<p>Le piante del nostro terrazzo e le loro esigenze.</p>

<div
style={{
display: "grid",
gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
gap: "20px",
marginTop: "28px",
}}
>
{[...plants].sort((a, b) => a.name.localeCompare(b.name, "it")).map((plant) => (
<Link href={`/pianta/${encodeURIComponent(plant.name)}`} style={{ textDecoration: "none", color: "inherit" }}><article
key={plant.name}
style={{
padding: "24px",
borderRadius: "20px",
background: "#f5f8f1",
border: "1px solid #dfe8d8",
}}
>
<div style={{ fontSize: "40px" }}>{plant.icon}</div>
<h2>{plant.name}</h2>
<p>
<em>{plant.scientific}</em>
</p>

<p><strong>Categoria:</strong> {plant.category}</p>
<p><strong>Esposizione:</strong> {plant.exposure}</p>
<p><strong>Annaffiatura:</strong> {plant.water}</p>
</article></Link>
))}
</div>
</main>
);
}
