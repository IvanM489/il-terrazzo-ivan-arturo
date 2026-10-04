import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { getPlantPhotoIds } from "../../../../lib/plant-photo-indicators";

function normalizeSeasons(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim().toLowerCase())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .replace(/[{}[\]"]/g, "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
  }

  return [];
}

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Non autenticato" },
        { status: 401 }
      );
    }

    const [
      terraceResult,
      indoorResult,
      bonsaiResult,
    ] = await Promise.all([
      supabase
        .from("plants")
        .select("*"),

      supabase
        .from("indoor_plants")
        .select("*"),

      supabase
        .from("bonsai")
        .select("*"),
    ]);

    const normalize = (plant, collection) => ({
      ...plant,
      collection,

      pruningSeason: normalizeSeasons(
        plant.pruning_season
      ),

      fertilizerSeason: normalizeSeasons(
        plant.fertilizer_season
      ),
    });

    const plants = [
      ...(terraceResult.data || []).map((plant) =>
        normalize(plant, "Terrazzo")
      ),

      ...(indoorResult.data || []).map((plant) =>
        normalize(plant, "Piante da interno")
      ),

      ...(bonsaiResult.data || []).map((plant) =>
        normalize(plant, "Bonsai")
      ),
    ];

    // Una sola lettura server-side per identificare le piante con foto.
    const plantsWithPhotos = await getPlantPhotoIds(supabase);

    const plantsWithPhotoFlags = plants.map((plant) => {
      const plantType =
        plant.collection === "Terrazzo"
          ? "plants"
          : plant.collection === "Piante da interno"
            ? "indoor_plants"
            : "bonsai";

      return {
        ...plant,
        hasPhotos: plantsWithPhotos.has(`${plantType}:${plant.id}`),
      };
    });

    const bonsaiDebug = plants
      .filter(
        (plant) =>
          plant.collection === "Bonsai"
      )
      .map((plant) => ({
        id: plant.id,
        name: plant.name,
        pruningSeason:
          plant.pruningSeason,
        fertilizerSeason:
          plant.fertilizerSeason,
      }));

    console.log(
      "🌳 BONSAI LETTI DALLA HOME:",
      bonsaiDebug
    );

    return NextResponse.json({
      plants: plantsWithPhotoFlags,

      counts: {
        terrazzo:
          terraceResult.data?.length || 0,

        interne:
          indoorResult.data?.length || 0,

        bonsai:
          bonsaiResult.data?.length || 0,
      },

      debug: {
        bonsai: bonsaiDebug,
      },
    });
  } catch (error) {
    console.error(
      "Errore API Home plants:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Errore nel caricamento delle piante.",
      },
      { status: 500 }
    );
  }
}
