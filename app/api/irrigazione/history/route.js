import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "../../../../lib/supabase/server";

const TUYA_BASE_URL = "https://openapi.tuyaeu.com";
const DEVICE_ID = "bf4f9c13a84f59ac39dybk";

function hmac(secret, value) {
  return crypto.createHmac("sha256", secret).update(value).digest("hex").toUpperCase();
}

async function getToken() {
  const clientId = process.env.TUYA_ACCESS_ID;
  const secret = process.env.TUYA_ACCESS_SECRET;
  const t = Date.now().toString();
  const path = "/v1.0/token?grant_type=1";
  const hash = crypto.createHash("sha256").update("").digest("hex");
  const stringToSign = `GET\n${hash}\n\n${path}`;
  const sign = hmac(secret, clientId + t + stringToSign);

  const response = await fetch(`${TUYA_BASE_URL}${path}`, {
    headers: {
      client_id: clientId,
      t,
      sign_method: "HMAC-SHA256",
      sign,
    },
    cache: "no-store",
  });

  const result = await response.json();
  if (!result.success) throw new Error(result.msg || "Autenticazione Tuya fallita.");
  return result.result.access_token;
}

async function tuyaGet(path, token) {
  const clientId = process.env.TUYA_ACCESS_ID;
  const secret = process.env.TUYA_ACCESS_SECRET;
  const t = Date.now().toString();
  const hash = crypto.createHash("sha256").update("").digest("hex");
  const stringToSign = `GET\n${hash}\n\n${path}`;
  const sign = hmac(secret, clientId + token + t + stringToSign);

  const response = await fetch(`${TUYA_BASE_URL}${path}`, {
    headers: {
      client_id: clientId,
      access_token: token,
      t,
      sign_method: "HMAC-SHA256",
      sign,
    },
    cache: "no-store",
  });

  return response.json();
}

export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const days = Math.min(Number(searchParams.get("days")) || 90, 180);
    const endTime = Date.now();
    const startTime = endTime - days * 24 * 60 * 60 * 1000;
    const token = await getToken();

    const path = `/v2.0/cloud/thing/${DEVICE_ID}/report-logs?codes=switch,valve_status&start_time=${startTime}&end_time=${endTime}&size=100`;
    const result = await tuyaGet(path, token);

    if (!result.success) {
      return NextResponse.json({ error: result.msg || "Errore nello storico Tuya.", tuya: result }, { status: 500 });
    }

    const logs = result.result?.logs || [];
    const events = logs
      .filter((log) => log.code === "switch" || log.code === "valve_status")
      .map((log) => ({
        id: `${log.event_time}-${log.code}`,
        date: new Date(Number(log.event_time)).toISOString(),
        code: log.code,
        value: log.value === true || log.value === "true",
      }))
      .filter((event) => Number.isFinite(new Date(event.date).getTime()))
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    return NextResponse.json({ success: true, deviceId: DEVICE_ID, days, events });
  } catch (error) {
    console.error("Errore storico irrigazione:", error);
    return NextResponse.json({ error: error?.message || "Errore interno." }, { status: 500 });
  }
}
