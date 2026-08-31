import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";

const ALLOWED_TYPES = ["indoor_plants", "bonsai"];
const TABLE = "plant_watering";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

    const [indoorResult, bonsaiResult, wateringResult] = await Promise.all([
      supabase.from("indoor_plants").select("id, name"),
      supabase.from("bonsai").select("id, name"),
      supabase.from(TABLE).select("id, plant_id, plant_type, watered_at"),
    ]);

    if (indoorResult.error) throw indoorResult.error;
    if (bonsaiResult.error) throw bonsaiResult.error;
    if (wateringResult.error) throw wateringResult.error;

    const plants = [
      ...(indoorResult.data || []).map((plant) => ({ ...plant, plantType: "indoor_plants", collection: "Piante da interno" })),
      ...(bonsaiResult.data || []).map((plant) => ({ ...plant, plantType: "bonsai", collection: "Bonsai" })),
    ];

    return NextResponse.json({ success: true, plants, records: wateringResult.data || [] });
  } catch (error) {
    console.error("Errore caricamento registro annaffiature:", error);
    return NextResponse.json({ error: error?.message || "Errore nel caricamento del registro annaffiature." }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

    const body = await request.json();
    const plantId = body?.plantId;
    const plantType = body?.plantType;
    if (!plantId || !ALLOWED_TYPES.includes(plantType)) return NextResponse.json({ error: "Pianta non valida." }, { status: 400 });

    const wateredAt = new Date().toISOString();
    const { error: deleteError } = await supabase.from(TABLE).delete().eq("plant_id", plantId).eq("plant_type", plantType);
    if (deleteError) throw deleteError;

    const { data, error: insertError } = await supabase.from(TABLE).insert({ plant_id: plantId, plant_type: plantType, watered_at: wateredAt }).select("id, plant_id, plant_type, watered_at").single();
    if (insertError) throw insertError;

    return NextResponse.json({ success: true, record: data });
  } catch (error) {
    console.error("Errore salvataggio annaffiatura:", error);
    return NextResponse.json({ error: error?.message || "Errore nel salvataggio dell'annaffiatura." }, { status: 500 });
  }
}
