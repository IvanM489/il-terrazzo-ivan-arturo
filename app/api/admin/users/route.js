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

function createAdminClient() {
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

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, nome, ruolo, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json(data || []);
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

  const nome = String(body.nome || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const ruolo =
    body.ruolo === "admin"
      ? "admin"
      : "user";

  if (!nome || !email || !password) {
    return NextResponse.json(
      {
        error:
          "Nome, email e password sono obbligatori.",
      },
      { status: 400 }
    );
  }

  if (password.length < 6) {
    return NextResponse.json(
      {
        error:
          "La password deve contenere almeno 6 caratteri.",
      },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  const {
    data: authData,
    error: authError,
  } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError) {
    return NextResponse.json(
      { error: authError.message },
      { status: 400 }
    );
  }

  const { data: profile, error: profileError } =
    await supabase
      .from("profiles")
      .insert({
        id: authData.user.id,
        nome,
        ruolo,
      })
      .select()
      .single();

  if (profileError) {
    await supabase.auth.admin.deleteUser(
      authData.user.id
    );

    return NextResponse.json(
      { error: profileError.message },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      ...profile,
      email,
    },
    { status: 201 }
  );
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

  if (!body.id || !["admin", "user"].includes(body.ruolo)) {
    return NextResponse.json(
      { error: "Dati non validi" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("profiles")
    .update({
      ruolo: body.ruolo,
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

  if (body.id === user.id) {
    return NextResponse.json(
      { error: "Non puoi eliminare il tuo stesso account." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  const { error: profileError } = await supabase
    .from("profiles")
    .delete()
    .eq("id", body.id);

  if (profileError) {
    return NextResponse.json(
      { error: profileError.message },
      { status: 500 }
    );
  }

  const { error: authError } =
    await supabase.auth.admin.deleteUser(body.id);

  if (authError) {
    return NextResponse.json(
      { error: authError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
  });
}
