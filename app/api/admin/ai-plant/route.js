import OpenAI from "openai";
import { createClient } from "../../../../lib/supabase/server";

async function getAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("ruolo")
    .eq("id", user.id)
    .single();

  if (profile?.ruolo !== "admin") return null;

  return user;
}

export async function POST(request) {
  try {
    const user = await getAdmin();

    if (!user) {
      return Response.json(
        { error: "Non autorizzato." },
        { status: 403 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return Response.json(
        { error: "Chiave OpenAI non configurata." },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const image = formData.get("image");

    if (!image || typeof image === "string") {
      return Response.json(
        { error: "Nessuna fotografia ricevuta." },
        { status: 400 }
      );
    }

    const arrayBuffer = await image.arrayBuffer();
    const base64Image =
      Buffer.from(arrayBuffer).toString("base64");

    const mimeType =
      image.type || "image/jpeg";

    const client = new OpenAI({
      apiKey,
    });

    const response = await client.responses.create({
      model: "gpt-5",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `
Sei un esperto botanico incaricato di compilare una scheda pianta.

Analizza attentamente la fotografia e restituisci SOLO un JSON valido, senza markdown e senza testo aggiuntivo.

Devi compilare questi campi:

{
  "name": "",
  "scientific": "",
  "icon": "",
  "category": "",
  "exposure": "",
  "water": "",
  "fertilizer": "",
  "pruning": "",
  "problems": "",
  "pruning_season": [],
  "fertilizer_season": []
}

REGOLE:

"name":
Nome comune della pianta. Se possibile usa il nome italiano più comune.

"scientific":
Nome scientifico, se identificabile.

"icon":
Una sola emoji appropriata alla pianta.

"category":
Deve essere ESATTAMENTE una di queste:
- Sempreverde
- Fiorita
- Rampicante
- Albero ornamentale
- Arbusto
- Erbacea

"exposure":
Indicazione pratica dell'esposizione consigliata.

"water":
Indicazione pratica sull'irrigazione.

"fertilizer":
Indicazione pratica sulla concimazione.

"pruning":
Indicazione pratica sulla potatura.

"problems":
Principali problemi, patologie o parassiti comuni della specie.

"pruning_season":
Array contenente SOLO valori tra:
- fine inverno
- primavera
- estate
- autunno
- inverno

"fertilizer_season":
Array contenente SOLO valori tra:
- fine inverno
- primavera
- estate
- autunno
- inverno

IMPORTANTE:
- Non inventare caratteristiche se la specie non è riconoscibile.
- Se il riconoscimento non è sicuro, usa il nome più probabile e fornisci comunque una scheda prudente.
- Le informazioni devono essere utili per una scheda di gestione domestica della pianta.
- Non aggiungere campi oltre quelli richiesti.
- Restituisci JSON valido.
              `.trim(),
            },
            {
              type: "input_image",
              image_url:
                `data:${mimeType};base64,${base64Image}`,
            },
          ],
        },
      ],
    });

    const text = response.output_text?.trim();

    if (!text) {
      return Response.json(
        { error: "L'AI non ha restituito informazioni." },
        { status: 502 }
      );
    }

    let plant;

    try {
      plant = JSON.parse(text);
    } catch {
      console.error(
        "Risposta AI non JSON:",
        text
      );

      return Response.json(
        {
          error:
            "L'AI ha restituito una risposta non interpretabile.",
        },
        { status: 502 }
      );
    }

    const validCategories = [
      "Sempreverde",
      "Fiorita",
      "Rampicante",
      "Albero ornamentale",
      "Arbusto",
      "Erbacea",
    ];

    const validSeasons = [
      "fine inverno",
      "primavera",
      "estate",
      "autunno",
      "inverno",
    ];

    if (!validCategories.includes(plant.category)) {
      plant.category = "Sempreverde";
    }

    plant.pruning_season = Array.isArray(
      plant.pruning_season
    )
      ? plant.pruning_season.filter((season) =>
          validSeasons.includes(season)
        )
      : [];

    plant.fertilizer_season = Array.isArray(
      plant.fertilizer_season
    )
      ? plant.fertilizer_season.filter((season) =>
          validSeasons.includes(season)
        )
      : [];

    return Response.json({
      plant: {
        name: plant.name || "",
        scientific: plant.scientific || "",
        icon: plant.icon || "🌿",
        category: plant.category || "Sempreverde",
        exposure: plant.exposure || "",
        water: plant.water || "",
        fertilizer: plant.fertilizer || "",
        pruning: plant.pruning || "",
        problems: plant.problems || "",
        pruning_season: plant.pruning_season,
        fertilizer_season:
          plant.fertilizer_season,
      },
    });
  } catch (error) {
    console.error(
      "ERRORE COMPILAZIONE PIANTA AI:",
      error
    );

    return Response.json(
      {
        error:
          error?.message ||
          "Errore durante il riconoscimento della pianta.",
      },
      { status: 500 }
    );
  }
}
