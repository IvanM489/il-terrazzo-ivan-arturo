import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

async function checkAdmin() {
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

export async function GET() {
  const { user, admin } = await checkAdmin();

  if (!user || !admin) {
    return NextResponse.json(
      { error: "Non autorizzato" },
      { status: 403 }
    );
  }

  const supabase = adminClient();

  const { data, error } = await supabase
    .from("bonsai")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}

export async function POST(request) {
  const { user, admin } = await checkAdmin();

  if (!user || !admin) {
    return NextResponse.json(
      { error: "Non autorizzato" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const supabase = adminClient();

  const { data, error } = await supabase
    .from("bonsai")
    .insert({
      name: body.name,
      scientific: body.scientific,
      icon: body.icon,
      category: body.category || "Bonsai",
      exposure: body.exposure,
      water: body.water,
      fertilizer: body.fertilizer,
      pruning: body.pruning,
      problems: body.problems,
      pruning_season: body.pruning_season || [],
      fertilizer_season: body.fertilizer_season || [],
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
  const { user, admin } = await checkAdmin();

  if (!user || !admin) {
    return NextResponse.json(
      { error: "Non autorizzato" },
      { status: 403 }
    );
  }

  const body = await request.json();

  if (!body.id) {
    return NextResponse.json(
      { error: "ID mancante" },
      { status: 400 }
    );
  }

  const supabase = adminClient();

  const { data, error } = await supabase
    .from("bonsai")
    .update({
      name: body.name,
      scientific: body.scientific,
      icon: body.icon,
      category: body.category || "Bonsai",
      exposure: body.exposure,
      water: body.water,
      fertilizer: body.fertilizer,
      pruning: body.pruning,
      problems: body.problems,
      pruning_season: body.pruning_season || [],
      fertilizer_season: body.fertilizer_season || [],
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
  const { user, admin } = await checkAdmin();

  if (!user || !admin) {
    return NextResponse.json(
      { error: "Non autorizzato" },
      { status: 403 }
    );
  }

  const body = await request.json();

  if (!body.id) {
    return NextResponse.json(
      { error: "ID mancante" },
      { status: 400 }
    );
  }

  const supabase = adminClient();

  const { error } = await supabase
    .from("bonsai")
    .delete()
    .eq("id", body.id);

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
