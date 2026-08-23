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
    .from("plants")
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

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("plants")
    .insert({
      name: body.name,
      scientific: body.scientific,
      icon: body.icon,
      category: body.category,
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

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("plants")
    .update({
      name: body.name,
      scientific: body.scientific,
      icon: body.icon,
      category: body.category,
      exposure: body.exposure,
      water: body.water,
      fertilizer: body.fertilizer,
      pruning: body.pruning,
      problems: body.problems,
      pruning_season: body.pruning_season || [],
      fertilizer_season: body.fertilizer_season || [],
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

  const supabase = createAdminClient();

  // 1. Recupera le fotografie associate alla pianta
  const { data: photos, error: photosError } = await supabase
    .from("plant_photos")
    .select("id, storage_path")
    .eq("plant_id", body.id)
    .eq("plant_type", "plants");

  if (photosError) {
    return NextResponse.json(
      { error: photosError.message },
      { status: 500 }
    );
  }

  // 2. Elimina i file fisici dal bucket Storage
  if (photos?.length) {
    const storagePaths = photos
      .map((photo) => photo.storage_path)
      .filter(Boolean);

    if (storagePaths.length) {
      const { error: storageError } = await supabase.storage
        .from("plant-photos")
        .remove(storagePaths);

      if (storageError) {
        return NextResponse.json(
          { error: storageError.message },
          { status: 500 }
        );
      }
    }
  }

  // 3. Elimina i record delle fotografie
  const { error: deletePhotosError } = await supabase
    .from("plant_photos")
    .delete()
    .eq("plant_id", body.id)
    .eq("plant_type", "plants");

  if (deletePhotosError) {
    return NextResponse.json(
      { error: deletePhotosError.message },
      { status: 500 }
    );
  }

  // 4. Elimina tutte le note/diario della pianta
  const { error: deleteNotesError } = await supabase
    .from("plant_notes")
    .delete()
    .eq("plant_id", body.id)
    .eq("plant_type", "plants");

  if (deleteNotesError) {
    return NextResponse.json(
      { error: deleteNotesError.message },
      { status: 500 }
    );
  }

  // 5. Infine elimina la pianta
  const { error: deletePlantError } = await supabase
    .from("plants")
    .delete()
    .eq("id", body.id);

  if (deletePlantError) {
    return NextResponse.json(
      { error: deletePlantError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
  });
}
  

