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
    const plantType = formData.get("plantType");

    if (!image || typeof image === "string") {
      return Response.json(
        { error: "Nessuna fotografia ricevuta." },
        { status: 400 }
      );
    }

    if (
      !["plants", "indoor_plants", "bonsai"].includes(
        plantType
      )
    ) {
      return Response.json(
        { error: "Tipo di pianta non valido." },
        { status: 400 }
      );
    }

    const arrayBuffer = await image.arrayBuffer();
    const base64Image =
      Buffer.from(arrayBuffer).toString("base64");

    const mimeType =
      image.type || "image/jpeg";

    let categoryInstruction;

    if (plantType === "plants") {
      categoryInstruction = `
"category":
Deve essere ESATTAMENTE una di queste:
- Sempreverde
- Fiorita
- Rampicante
- Albero ornamentale
- Arbusto
- Erbacea
`;
    } else if (plantType === "indoor_plants") {
      categoryInstruction = `
"category":
La categoria deve essere "Pianta da interno".
`;
    } else {
      categoryInstruction = `
"category":
La categoria deve essere "Bonsai".
`;
    }

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

Analizza attentamente la fotografia.

Restituisci SOLO un JSON valido, senza markdown e senza testo aggiuntivo.

Il JSON deve contenere ESATTAMENTE questi campi:

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
Nome comune della pianta.

"scientific":
Nome scientifico, se identificabile.

"icon":
Una sola emoji appropriata.

${categoryInstruction}

"exposure":
Indicazione pratica dell'esposizione consigliata.

"water":
Indicazione pratica sull'irrigazione.

"fertilizer":
Indicazione pratica sulla concimazione.

"pruning":
Indicazione pratica sulla potatura.

"problems":
Principali problemi, patologie o parassiti comuni.

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
- Non inventare dettagli inutilmente.
- Se la specie non è identificabile con certezza, usa la migliore identificazione possibile.
- Le informazioni devono essere pratiche e adatte alla gestione domestica.
- Non aggiungere altri campi.
- Restituisci esclusivamente JSON valido.
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
        {
          error:
            "L'AI non ha restituito informazioni.",
        },
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

    const validSeasons = [
      "fine inverno",
      "primavera",
      "estate",
      "autunno",
      "inverno",
    ];

    let category = plant.category || "";

    if (plantType === "indoor_plants") {
      category = "Pianta da interno";
    }

    if (plantType === "bonsai") {
      category = "Bonsai";
    }

    if (plantType === "plants") {
      const validCategories = [
        "Sempreverde",
        "Fiorita",
        "Rampicante",
        "Albero ornamentale",
        "Arbusto",
        "Erbacea",
      ];

      if (!validCategories.includes(category)) {
        category = "Sempreverde";
      }
    }

    const result = {
      name: plant.name || "",
      scientific: plant.scientific || "",
      icon:
        plant.icon ||
        (plantType === "bonsai" ? "🌳" : "🪴"),
      category,
      exposure: plant.exposure || "",
      water: plant.water || "",
      fertilizer: plant.fertilizer || "",
      pruning: plant.pruning || "",
      problems: plant.problems || "",
      pruning_season: Array.isArray(
        plant.pruning_season
      )
        ? plant.pruning_season.filter((season) =>
            validSeasons.includes(season)
          )
        : [],
      fertilizer_season: Array.isArray(
        plant.fertilizer_season
      )
        ? plant.fertilizer_season.filter((season) =>
            validSeasons.includes(season)
          )
        : [],
    };

    return Response.json({
      plant: result,
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
