import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const ALLOWED_TYPES = ["plants", "indoor_plants", "bonsai"];
const ALLOWED_ACTIONS = ["potata", "concimata"];

function adminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function getUser() {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  return user;
}

async function getPlants(supabase) {
  const [plants, indoor, bonsai] = await Promise.all([
    supabase.from("plants").select("id, name"),
    supabase.from("indoor_plants").select("id, name"),
    supabase.from("bonsai").select("id, name"),
  ]);
  for (const result of [plants, indoor, bonsai]) if (result.error) throw result.error;
  return [
    ...(plants.data || []).map((p) => ({ ...p, plant_type: "plants" })),
    ...(indoor.data || []).map((p) => ({ ...p, plant_type: "indoor_plants" })),
    ...(bonsai.data || []).map((p) => ({ ...p, plant_type: "bonsai" })),
  ];
}

async function enrichActions(supabase, rows) {
  const plants = await getPlants(supabase);
  const map = new Map(plants.map((p) => [`${p.plant_type}:${p.id}`, p.name]));
  return (rows || []).map((row) => ({
    ...row,
    plant_name: map.get(`${row.plant_type}:${row.plant_id}`) || "Pianta",
  }));
}

export async function GET(request) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const supabase = adminClient();
    let query = supabase.from("plant_actions").select("id, plant_id, plant_type, type, performed_at, user_id, created_at").order("performed_at", { ascending: false });
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const plantId = searchParams.get("plantId");
    const plantType = searchParams.get("plantType");
    if (from) query = query.gte("performed_at", from);
    if (to) query = query.lt("performed_at", to);
    if (plantId) query = query.eq("plant_id", plantId);
    if (plantType) query = query.eq("plant_type", plantType);
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json(await enrichActions(supabase, data));
  } catch (error) {
    console.error("Errore caricamento azioni piante:", error);
    return NextResponse.json({ error: error?.message || "Errore nel caricamento delle attività." }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    const body = await request.json();
    const supabase = adminClient();

    if (Array.isArray(body?.legacyActions)) {
      const plants = await getPlants(supabase);
      const byName = new Map(plants.map((p) => [p.name, p]));
      const rows = body.legacyActions
        .filter((a) => a?.plant && ALLOWED_ACTIONS.includes(a?.type) && a?.date)
        .map((a) => {
          const plant = byName.get(a.plant);
          if (!plant) return null;
          return {
            plant_id: plant.id,
            plant_type: plant.plant_type,
            type: a.type,
            performed_at: new Date(a.date).toISOString(),
            user_id: user.id,
            legacy_key: `${plant.plant_type}:${plant.id}:${a.type}:${new Date(a.date).toISOString()}`,
          };
        })
        .filter(Boolean);
      if (rows.length) {
        const { error } = await supabase.from("plant_actions").upsert(rows, { onConflict: "legacy_key", ignoreDuplicates: true });
        if (error) throw error;
      }
      return NextResponse.json({ success: true, migrated: rows.length });
    }

    const { plantId, plantType, type, performedAt } = body || {};
    if (!plantId || !ALLOWED_TYPES.includes(plantType) || !ALLOWED_ACTIONS.includes(type)) {
      return NextResponse.json({ error: "Dati attività non validi." }, { status: 400 });
    }
    const date = performedAt ? new Date(performedAt) : new Date();
    if (Number.isNaN(date.getTime())) return NextResponse.json({ error: "Data non valida." }, { status: 400 });
    const { data, error } = await supabase.from("plant_actions").insert({
      plant_id: plantId,
      plant_type: plantType,
      type,
      performed_at: date.toISOString(),
      user_id: user.id,
    }).select("id, plant_id, plant_type, type, performed_at, user_id, created_at").single();
    if (error) throw error;
    return NextResponse.json({ success: true, record: (await enrichActions(supabase, [data]))[0] });
  } catch (error) {
    console.error("Errore salvataggio azione pianta:", error);
    return NextResponse.json({ error: error?.message || "Errore nel salvataggio dell'attività." }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    const { id, performedAt } = await request.json();
    if (!id || !performedAt) return NextResponse.json({ error: "Dati modifica non validi." }, { status: 400 });
    const date = new Date(performedAt);
    if (Number.isNaN(date.getTime())) return NextResponse.json({ error: "Data non valida." }, { status: 400 });
    const supabase = adminClient();
    const { data, error } = await supabase.from("plant_actions").update({ performed_at: date.toISOString() }).eq("id", id).select("id, plant_id, plant_type, type, performed_at, user_id, created_at").single();
    if (error) throw error;
    return NextResponse.json({ success: true, record: (await enrichActions(supabase, [data]))[0] });
  } catch (error) {
    console.error("Errore modifica azione pianta:", error);
    return NextResponse.json({ error: error?.message || "Errore nella modifica dell'attività." }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    const body = await request.json();
    const ids = Array.isArray(body?.ids) ? body.ids.filter(Boolean) : body?.id ? [body.id] : [];
    if (!ids.length) return NextResponse.json({ error: "Nessuna attività selezionata." }, { status: 400 });
    const supabase = adminClient();
    const { error } = await supabase.from("plant_actions").delete().in("id", ids);
    if (error) throw error;
    return NextResponse.json({ success: true, deleted: ids.length });
  } catch (error) {
    console.error("Errore eliminazione azione pianta:", error);
    return NextResponse.json({ error: error?.message || "Errore nell'eliminazione dell'attività." }, { status: 500 });
  }
}
