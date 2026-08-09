import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

async function getAuth() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, admin: false };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("ruolo")
    .eq("id", user.id)
    .single();

  return {
    user,
    admin: profile?.ruolo === "admin",
  };
}

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

export async function GET(request) {
  const { user } = await getAuth();

  if (!user) {
    return NextResponse.json(
      { error: "Non autenticato" },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const plantId = searchParams.get("plantId");
  const plantType = searchParams.get("plantType");

  if (!plantId || !plantType) {
    return NextResponse.json(
      { error: "Pianta non specificata" },
      { status: 400 }
    );
  }

  const supabase = adminClient();

  const { data, error } = await supabase
    .from("plant_notes")
    .select("*")
    .eq("plant_id", plantId)
    .eq("plant_type", plantType)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}

export async function POST(request) {
  const { user } = await getAuth();

  if (!user) {
    return NextResponse.json(
      { error: "Non autenticato" },
      { status: 401 }
    );
  }

  const body = await request.json();

  if (
    !body.plantId ||
    !body.plantType ||
    !body.text?.trim()
  ) {
    return NextResponse.json(
      { error: "Il testo della nota è obbligatorio." },
      { status: 400 }
    );
  }

  if (
    !["plants", "indoor_plants", "bonsai"].includes(
      body.plantType
    )
  ) {
    return NextResponse.json(
      { error: "Tipo di pianta non valido." },
      { status: 400 }
    );
  }

  const supabase = adminClient();

  const { data, error } = await supabase
    .from("plant_notes")
    .insert({
      plant_id: body.plantId,
      plant_type: body.plantType,
      user_id: user.id,
      text: body.text.trim(),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}

export async function PUT(request) {
  const { user, admin } = await getAuth();

  if (!user) {
    return NextResponse.json(
      { error: "Non autenticato" },
      { status: 401 }
    );
  }

  const body = await request.json();

  if (!body.id || !body.text?.trim()) {
    return NextResponse.json(
      { error: "Nota non valida." },
      { status: 400 }
    );
  }

  const supabase = adminClient();

  const { data: note, error: findError } =
    await supabase
      .from("plant_notes")
      .select("*")
      .eq("id", body.id)
      .single();

  if (findError || !note) {
    return NextResponse.json(
      { error: "Nota non trovata." },
      { status: 404 }
    );
  }

  if (note.user_id !== user.id && !admin) {
    return NextResponse.json(
      { error: "Non autorizzato." },
      { status: 403 }
    );
  }

  const { data, error } = await supabase
    .from("plant_notes")
    .update({
      text: body.text.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", body.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}

export async function DELETE(request) {
  const { user, admin } = await getAuth();

  if (!user) {
    return NextResponse.json(
      { error: "Non autenticato" },
      { status: 401 }
    );
  }

  const body = await request.json();

  if (!body.id) {
    return NextResponse.json(
      { error: "Nota non specificata." },
      { status: 400 }
    );
  }

  const supabase = adminClient();

  const { data: note, error: findError } =
    await supabase
      .from("plant_notes")
      .select("*")
      .eq("id", body.id)
      .single();

  if (findError || !note) {
    return NextResponse.json(
      { error: "Nota non trovata." },
      { status: 404 }
    );
  }

  if (note.user_id !== user.id && !admin) {
    return NextResponse.json(
      { error: "Non autorizzato." },
      { status: 403 }
    );
  }

  const { error } = await supabase
    .from("plant_notes")
    .delete()
    .eq("id", body.id);

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
  });
}
