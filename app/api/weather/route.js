import { NextResponse } from "next/server";

const LATITUDE = 45.4642;
const LONGITUDE = 9.19;

export async function GET() {
  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", LATITUDE);
    url.searchParams.set("longitude", LONGITUDE);
    url.searchParams.set("current", "temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day");
    url.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max");
    url.searchParams.set("timezone", "Europe/Rome");
    url.searchParams.set("forecast_days", "5");
    url.searchParams.set("temperature_unit", "celsius");
    url.searchParams.set("wind_speed_unit", "kmh");

    const response = await fetch(url.toString(), {
      next: { revalidate: 900 },
    });

    if (!response.ok) {
      throw new Error(`Open-Meteo HTTP ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" },
    });
  } catch (error) {
    console.error("Errore API meteo:", error);
    return NextResponse.json(
      { error: "Meteo temporaneamente non disponibile." },
      { status: 503 }
    );
  }
}
