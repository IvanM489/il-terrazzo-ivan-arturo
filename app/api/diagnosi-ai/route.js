import OpenAI from "openai";

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
    const base64Image = Buffer.from(arrayBuffer).toString("base64");

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
Sei un esperto di patologia vegetale e cura delle piante.

Analizza attentamente la fotografia della pianta.

Fornisci una risposta in italiano, chiara e pratica, strutturata così:

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

Non inventare dettagli che non sono visibili nella fotografia.
Se la fotografia non è sufficientemente chiara per una diagnosi attendibile, dichiaralo esplicitamente.
Non presentare la valutazione come una certezza assoluta.
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

    return Response.json({
      diagnosis,
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
