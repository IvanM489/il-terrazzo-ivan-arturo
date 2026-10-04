import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Restituisce gli ID delle piante con almeno una foto.
 * Deve essere chiamato esclusivamente dal server e dopo aver verificato
 * la sessione dell'utente tramite il client Supabase autenticato.
 */
export async function getPlantPhotoIds(userClient, plantType) {
  const {
    data: { user },
  } = await userClient.auth.getUser();

  if (!user) return new Set();

  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  let query = adminClient
    .from("plant_photos")
    .select("plant_id, plant_type");

  if (plantType) query = query.eq("plant_type", plantType);

  const { data, error } = await query;

  if (error) {
    console.error("Errore nel recupero delle foto delle piante:", error);
    return new Set();
  }

  return new Set(
    (data || []).map((photo) => `${photo.plant_type}:${photo.plant_id}`)
  );
}
