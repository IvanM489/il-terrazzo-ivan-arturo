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
    .from("plant_photos")
    .select("*")
    .eq("plant_id", plantId)
    .eq("plant_type", plantType)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  const photos = await Promise.all(
    data.map(async (photo) => {
      const { data: signed } = await supabase.storage
        .from("plant-photos")
        .createSignedUrl(photo.storage_path, 3600);

      return {
        ...photo,
        url: signed?.signedUrl || null,
      };
    })
  );

  return NextResponse.json(photos);
}

export async function POST(request) {
  const { user } = await getAuth();

  if (!user) {
    return NextResponse.json(
      { error: "Non autenticato" },
      { status: 401 }
    );
  }

  const formData = await request.formData();

  const file = formData.get("file");
  const plantId = formData.get("plantId");
  const plantType = formData.get("plantType");
  const caption = formData.get("caption") || null;

  if (
    !file ||
    !plantId ||
    !plantType
  ) {
    return NextResponse.json(
      { error: "Dati mancanti" },
      { status: 400 }
    );
  }

  if (!["plants", "indoor_plants", "bonsai"].includes(plantType)) {
    return NextResponse.json(
      { error: "Tipo di pianta non valido" },
      { status: 400 }
    );
  }

  if (!file.type?.startsWith("image/")) {
    return NextResponse.json(
      { error: "Il file deve essere un'immagine" },
      { status: 400 }
    );
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json(
      { error: "La foto non può superare 10 MB" },
      { status: 400 }
    );
  }

  const extension =
    file.name.split(".").pop()?.toLowerCase() || "jpg";

  const fileName =
    `${crypto.randomUUID()}.${extension}`;

  const storagePath =
    `${plantType}/${plantId}/${user.id}/${fileName}`;

  const supabase = adminClient();

  const buffer = Buffer.from(
    await file.arrayBuffer()
  );

  const { error: uploadError } =
    await supabase.storage
      .from("plant-photos")
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

  if (uploadError) {
    return NextResponse.json(
      { error: uploadError.message },
      { status: 500 }
    );
  }

  const { data, error } = await supabase
    .from("plant_photos")
    .insert({
      plant_id: plantId,
      plant_type: plantType,
      user_id: user.id,
      storage_path: storagePath,
      caption,
    })
    .select()
    .single();

  if (error) {
    await supabase.storage
      .from("plant-photos")
      .remove([storagePath]);

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
      { error: "Foto non specificata" },
      { status: 400 }
    );
  }

  const supabase = adminClient();

  const { data: photo, error: findError } =
    await supabase
      .from("plant_photos")
      .select("*")
      .eq("id", body.id)
      .single();

  if (findError || !photo) {
    return NextResponse.json(
      { error: "Foto non trovata" },
      { status: 404 }
    );
  }

  if (photo.user_id !== user.id && !admin) {
    return NextResponse.json(
      { error: "Non autorizzato" },
      { status: 403 }
    );
  }

  const { error: storageError } =
    await supabase.storage
      .from("plant-photos")
      .remove([photo.storage_path]);

  if (storageError) {
    return NextResponse.json(
      { error: storageError.message },
      { status: 500 }
    );
  }

  const { error } = await supabase
    .from("plant_photos")
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
