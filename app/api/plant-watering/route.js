import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const ALLOWED_TYPES = ["indoor_plants", "bonsai"];
const TABLE = "plant_watering";

function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function getAuthenticatedUser() {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  return user;
}

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

    const supabase = createAdminClient();
    const [indoorResult, bonsaiResult, wateringResult] = await Promise.all([
      supabase.from("indoor_plants").select("id, name"),
      supabase.from("bonsai").select("id, name"),
      supabase.from(TABLE).select("id, plant_id, plant_type, watered_at").order("watered_at", { ascending: false }),
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
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

    const body = await request.json();
    const plantId = body?.plantId;
    const plantType = body?.plantType;
    if (!plantId || !ALLOWED_TYPES.includes(plantType)) {
      return NextResponse.json({ error: "Pianta non valida." }, { status: 400 });
    }

    const supabase = createAdminClient();
    const wateredAt = body?.wateredAt ? new Date(body.wateredAt) : new Date();
    if (Number.isNaN(wateredAt.getTime())) return NextResponse.json({ error: "Data non valida." }, { status: 400 });

    const { data, error: insertError } = await supabase
      .from(TABLE)
      .insert({ plant_id: plantId, plant_type: plantType, watered_at: wateredAt.toISOString() })
      .select("id, plant_id, plant_type, watered_at")
      .single();

    if (insertError) throw insertError;
    return NextResponse.json({ success: true, record: data });
  } catch (error) {
    console.error("Errore salvataggio annaffiatura:", error);
    return NextResponse.json({ error: error?.message || "Errore nel salvataggio dell'annaffiatura." }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

    const body = await request.json();
    const id = body?.id;
    if (!id) return NextResponse.json({ error: "ID irrigazione mancante." }, { status: 400 });

    const wateredAt = body?.wateredAt ? new Date(body.wateredAt) : null;
    if (!wateredAt || Number.isNaN(wateredAt.getTime())) {
      return NextResponse.json({ error: "Data irrigazione non valida." }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from(TABLE)
      .update({ watered_at: wateredAt.toISOString() })
      .eq("id", id)
      .select("id, plant_id, plant_type, watered_at")
      .single();

    if (error) throw error;
    if (!data || !ALLOWED_TYPES.includes(data.plant_type)) {
      return NextResponse.json({ error: "Irrigazione non trovata." }, { status: 404 });
    }

    return NextResponse.json({ success: true, record: data });
  } catch (error) {
    console.error("Errore modifica annaffiatura:", error);
    return NextResponse.json({ error: error?.message || "Errore nella modifica dell'annaffiatura." }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

    const body = await request.json();
    const ids = Array.isArray(body?.ids) ? body.ids.filter(Boolean) : body?.id ? [body.id] : [];
    if (!ids.length) return NextResponse.json({ error: "Nessuna irrigazione selezionata." }, { status: 400 });

    const supabase = createAdminClient();
    const { error } = await supabase.from(TABLE).delete().in("id", ids).in("plant_type", ALLOWED_TYPES);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Errore eliminazione annaffiatura:", error);
    return NextResponse.json({ error: error?.message || "Errore nell'eliminazione dell'annaffiatura." }, { status: 500 });
  }
}
