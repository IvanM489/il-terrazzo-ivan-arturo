import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

async function checkAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, admin: false };
  const { data: profile } = await supabase.from("profiles").select("ruolo").eq("id", user.id).single();
  return { user, admin: profile?.ruolo === "admin" };
}

function createAdminClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function logActivity(supabase, userId, action, details) {
  const { error } = await supabase.from("activity_logs").insert({ user_id: userId, action, details: details ? String(details).slice(0, 500) : null });
  if (error) console.error("Errore registrazione log:", error);
}

export async function GET() {
  const { user, admin } = await checkAdmin();
  if (!user || !admin) return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  const supabase = createAdminClient();
  const [{ data, error }, { data: authUsers, error: authError }] = await Promise.all([
    supabase.from("profiles").select("id, nome, ruolo, created_at").order("created_at", { ascending: true }),
    supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (authError) return NextResponse.json({ error: authError.message }, { status: 500 });
  const emails = new Map((authUsers?.users || []).map((authUser) => [authUser.id, authUser.email || ""]));
  return NextResponse.json((data || []).map((profile) => ({ ...profile, email: emails.get(profile.id) || "" })));
}

export async function POST(request) {
  const { user, admin } = await checkAdmin();
  if (!user || !admin) return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  const body = await request.json();
  const nome = String(body.nome || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const ruolo = body.ruolo === "admin" ? "admin" : "user";
  if (!nome || !email || !password) return NextResponse.json({ error: "Nome, email e password sono obbligatori." }, { status: 400 });
  if (password.length < 6) return NextResponse.json({ error: "La password deve contenere almeno 6 caratteri." }, { status: 400 });
  const supabase = createAdminClient();
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 });
  const { data: profile, error: profileError } = await supabase.from("profiles").insert({ id: authData.user.id, nome, ruolo }).select().single();
  if (profileError) {
    await supabase.auth.admin.deleteUser(authData.user.id);
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }
  await logActivity(supabase, user.id, "Inserimento utente", `Utente: ${nome} (${email}) — ruolo: ${ruolo}`);
  return NextResponse.json({ ...profile, email }, { status: 201 });
}

export async function PUT(request) {
  const { user, admin } = await checkAdmin();
  if (!user || !admin) return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  const body = await request.json();
  const id = String(body.id || "").trim();
  const nome = String(body.nome || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const ruolo = String(body.ruolo || "").trim();
  if (!id || !nome || !email || !["admin", "user"].includes(ruolo)) return NextResponse.json({ error: "Nome, email, ruolo e ID sono obbligatori." }, { status: 400 });
  const supabase = createAdminClient();
  const { data: currentProfile } = await supabase.from("profiles").select("id, nome, ruolo").eq("id", id).single();
  if (!currentProfile) return NextResponse.json({ error: "Utente non trovato." }, { status: 404 });
  const { data: currentAuthData, error: currentAuthError } = await supabase.auth.admin.getUserById(id);
  if (currentAuthError || !currentAuthData?.user) return NextResponse.json({ error: "Account utente non trovato." }, { status: 404 });
  const currentEmail = currentAuthData.user.email || "";
  const emailChanged = currentEmail.toLowerCase() !== email;
  if (emailChanged) {
    const { error: authError } = await supabase.auth.admin.updateUserById(id, { email, email_confirm: true });
    if (authError) return NextResponse.json({ error: authError.message }, { status: 400 });
  }
  const { data, error } = await supabase.from("profiles").update({ nome, ruolo }).eq("id", id).select().single();
  if (error) {
    if (emailChanged) await supabase.auth.admin.updateUserById(id, { email: currentEmail, email_confirm: true });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const changes = [];
  if (currentProfile.nome !== nome) changes.push(`nome: "${currentProfile.nome || ""}" → "${nome}"`);
  if (currentEmail !== email) changes.push(`email: ${currentEmail || ""} → ${email}`);
  if (currentProfile.ruolo !== ruolo) changes.push(`ruolo: ${currentProfile.ruolo || "user"} → ${ruolo}`);
  await logActivity(supabase, user.id, "Modifica utente", `Utente: ${nome} (${email}) — ${changes.length ? changes.join("; ") : "nessuna variazione"}`);
  return NextResponse.json({ ...data, email });
}

export async function DELETE(request) {
  const { user, admin } = await checkAdmin();
  if (!user || !admin) return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  const body = await request.json();
  if (!body.id) return NextResponse.json({ error: "ID mancante" }, { status: 400 });
  if (body.id === user.id) return NextResponse.json({ error: "Non puoi eliminare il tuo stesso account." }, { status: 400 });
  const supabase = createAdminClient();
  const { data: profile } = await supabase.from("profiles").select("nome").eq("id", body.id).single();
  const { data: authData } = await supabase.auth.admin.getUserById(body.id);
  const displayName = profile?.nome || "Utente senza nome";
  const email = authData?.user?.email || "email sconosciuta";
  const { error: profileError } = await supabase.from("profiles").delete().eq("id", body.id);
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
  const { error: authError } = await supabase.auth.admin.deleteUser(body.id);
  if (authError) return NextResponse.json({ error: authError.message }, { status: 500 });
  await logActivity(supabase, user.id, "Cancellazione utente", `Utente: ${displayName} (${email})`);
  return NextResponse.json({ success: true });
}
