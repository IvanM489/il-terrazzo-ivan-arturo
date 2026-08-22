import OpenAI from "openai";
import { createClient } from "../../../lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

function adminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

async function getAuthenticatedUser() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function findBestPlantMatch(plants, aiPlantName) {
  const target = normalize(aiPlantName);

  if (!target) return null;

  // 1. Corrispondenza esatta
  const exact = plants.find(
    (plant) => normalize(plant.name) === target
  );

  if (exact) return exact;

  // 2. Il nome AI contiene il nome presente nel database
  const contained = plants
    .filter((plant) => {
      const name = normalize(plant.name);
      return name && (target.includes(name) || name.includes(target));
    })
    .sort(
      (a, b) =>
        normalize(b.name).length - normalize(a.name).length
    );

  return contained[0] || null;
}

export async function POST(request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return Response.json(
        {
          error:
            "Chiave OpenAI non configurata. Controlla OPENAI_API_KEY nel file .env.local.",
        },
        { status: 500 }
      );
    }

    const user = await getAuthenticatedUser();

    if (!user) {
      return Response.json(
        {
          error: "Devi essere autenticato per usare la diagnosi AI.",
        },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const image = formData.get("image");

    if (!image || typeof image === "string") {
      return Response.json(
        {
          error: "Nessuna fotografia ricevuta.",
        },
        { status: 400 }
      );
    }

    const arrayBuffer = await image.arrayBuffer();
    const base64Image =
      Buffer.from(arrayBuffer).toString("base64");

    const mimeType = image.type || "image/jpeg";

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
Sei un esperto di botanica, patologia vegetale e cura delle piante.

Analizza attentamente la fotografia.

Devi produrre DUE risultati:

A) UNA DIAGNOSI COMPLETA
Deve essere dettagliata e pratica e deve seguire esattamente questa struttura:

1. IDENTIFICAZIONE PROBABILE
Indica quale problema, patologia, parassita o stress potrebbe essere presente.

2. GRADO DI CERTEZZA
Indica quanto sei sicuro della valutazione e spiega brevemente perché.

3. COSA OSSERVO
Descrivi i principali sintomi visibili nella fotografia.

4. POSSIBILI CAUSE
Indica le cause più probabili, distinguendo quando possibile tra malattia, parassiti, irrigazione, esposizione, carenze nutrizionali o altri fattori ambientali.

5. COSA FARE ORA
Dai indicazioni pratiche e prudenti per intervenire.

6. COSA CONTROLLARE
Indica quali ulteriori elementi sarebbe utile fotografare o controllare per confermare la diagnosi.

B) DATI SINTETICI PER LA NOTA AUTOMATICA

Alla FINE della risposta aggiungi ESATTAMENTE questo blocco:

---DATI_NOTA_AI---
PIANTA: [nome comune o botanico identificato]
DIAGNOSI_BREVE: [massimo 80 caratteri, molto sintetica]
CONFIDENZA_PIANTA: [ALTA oppure MEDIA oppure BASSA]
---FINE_DATI_NOTA_AI---

Esempio:

---DATI_NOTA_AI---
PIANTA: Azalea
DIAGNOSI_BREVE: Cocciniglia
CONFIDENZA_PIANTA: ALTA
---FINE_DATI_NOTA_AI---

IMPORTANTE:
- Non inventare dettagli che non sono visibili.
- Se la pianta non è identificabile con sufficiente sicurezza, usa CONFIDENZA_PIANTA: BASSA.
- Se il problema non è identificabile con certezza, esprimi l'incertezza nella diagnosi.
- DIAGNOSI_BREVE deve essere molto breve, ad esempio "Cocciniglia", "Ragno rosso", "Stress idrico", "Clorosi ferrica".
- Non inserire spiegazioni dentro DIAGNOSI_BREVE.
- La diagnosi completa deve rimanere ricca e dettagliata.
              `.trim(),
            },
            {
              type: "input_image",
              image_url: `data:${mimeType};base64,${base64Image}`,
            },
          ],
        },
      ],
    });

    const diagnosis = response.output_text;

    if (!diagnosis) {
      return Response.json(
        {
          error:
            "OpenAI ha ricevuto la fotografia ma non ha restituito una diagnosi.",
        },
        { status: 502 }
      );
    }

    /*
     * Estrazione dei dati sintetici dalla risposta AI.
     */
    const noteBlockMatch = diagnosis.match(
      /---DATI_NOTA_AI---([\s\S]*?)---FINE_DATI_NOTA_AI---/
    );

    let plantName = "";
    let diagnosisShort = "";
    let plantConfidence = "BASSA";

    console.log("🔎 DEBUG DATI NOTA AI:", {
      plantName,
      diagnosisShort,
      plantConfidence,
      noteBlockFound: !!noteBlockMatch,
    });

    if (noteBlockMatch) {
      const block = noteBlockMatch[1];

      const plantMatch = block.match(
        /PIANTA:\s*(.+)/i
      );

      const diagnosisMatch = block.match(
        /DIAGNOSI_BREVE:\s*(.+)/i
      );

      const confidenceMatch = block.match(
        /CONFIDENZA_PIANTA:\s*(ALTA|MEDIA|BASSA)/i
      );

      plantName = plantMatch?.[1]?.trim() || "";
      diagnosisShort =
        diagnosisMatch?.[1]?.trim() || "";
      plantConfidence =
        confidenceMatch?.[1]?.trim().toUpperCase() || "BASSA";
    }

    /*
     * La parte tecnica utilizzata per la nota non viene
     * mostrata nella diagnosi completa.
     */
    const cleanDiagnosis = diagnosis
      .replace(
        /---DATI_NOTA_AI---[\s\S]*?---FINE_DATI_NOTA_AI---/i,
        ""
      )
      .trim();

    let noteCreated = false;
    let matchedPlant = null;

    /*
     * Creazione automatica della nota solo se:
     * - la pianta è stata identificata
     * - la confidenza è ALTA o MEDIA
     * - esiste davvero nel database
     */
    if (
      plantName &&
      diagnosisShort &&
      (plantConfidence === "ALTA" ||
        plantConfidence === "MEDIA")
    ) {
      const supabase = adminClient();

      const tables = [
        {
          table: "plants",
          type: "plants",
        },
        {
          table: "indoor_plants",
          type: "indoor_plants",
        },
        {
          table: "bonsai",
          type: "bonsai",
        },
      ];

      const allPlants = [];

      for (const item of tables) {
        const { data, error } = await supabase
          .from(item.table)
          .select("id, name");

        if (!error && data) {
          data.forEach((plant) => {
            allPlants.push({
              ...plant,
              plantType: item.type,
            });
          });
        }
      }

      matchedPlant = findBestPlantMatch(
        allPlants,
        plantName
      );

      console.log(
        "🌱 DEBUG NOTA COMPLETO:",
        JSON.stringify({
          plantName,
          diagnosisShort,
          plantConfidence,
          noteBlockFound: !!noteBlockMatch,
          databasePlants: allPlants.map((plant) => ({
            id: plant.id,
            name: plant.name,
            plantType: plant.plantType,
          })),
          matchedPlant,
        })
      );

      if (matchedPlant) {
        const now = new Date();

        const date = now.toLocaleDateString("it-IT", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });

        const noteText =
          `${date} — Diagnosi AI: ${matchedPlant.name} — ${diagnosisShort}.`;

        const { error: noteError } = await supabase
          .from("plant_notes")
          .insert({
            plant_id: matchedPlant.id,
            plant_type: matchedPlant.plantType,
            user_id: user.id,
            text: noteText,
          });

        if (!noteError) {
          noteCreated = true;
          console.log(
            "✅ DEBUG NOTA CREATA:",
            noteText
          );
        } else {
          console.error(
            "❌ DEBUG ERRORE INSERT NOTA:",
            noteError
          );
          console.error(
            "Errore creazione nota diagnosi AI:",
            noteError
          );
        }
      }
    }

    return Response.json({
      diagnosis: cleanDiagnosis,
      noteCreated,
      matchedPlant: matchedPlant
        ? {
            id: matchedPlant.id,
            name: matchedPlant.name,
            plantType: matchedPlant.plantType,
          }
        : null,
      diagnosisShort: diagnosisShort || null,
    });
  } catch (error) {
    console.error("ERRORE DIAGNOSI AI:", error);

    return Response.json(
      {
        error:
          error?.message ||
          "Si è verificato un errore durante l'analisi della fotografia.",
      },
      { status: 500 }
    );
  }
}
