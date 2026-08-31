import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "../../../../lib/supabase/server";

const TUYA_BASE_URL = "https://openapi.tuyaeu.com";
const DEVICE_ID = "bf4f9c13a84f59ac39dybk";
const EMPTY_BODY_SHA256 = crypto.createHash("sha256").update("").digest("hex");

function hmac(secret, value) {
  return crypto.createHmac("sha256", secret).update(value).digest("hex").toUpperCase();
}

function buildStringToSign(method, path) {
  // Tuya canonicalizes the URL for signing with decoded query values.
  // The API Explorer request for report-logs uses no custom Signature-Headers
  // and no nonce, so the third line of stringToSign is intentionally empty.
  const canonicalUrl = decodeURIComponent(path);
  return `${method.toUpperCase()}\n${EMPTY_BODY_SHA256}\n\n${canonicalUrl}`;
}

function signTokenRequest(clientId, secret, t, path) {
  const stringToSign = buildStringToSign("GET", path);
  return hmac(secret, `${clientId}${t}${stringToSign}`);
}

function signBusinessRequest(clientId, secret, token, t, path) {
  const stringToSign = buildStringToSign("GET", path);
  return hmac(secret, `${clientId}${token}${t}${stringToSign}`);
}

async function getToken() {
  const clientId = process.env.TUYA_ACCESS_ID;
  const secret = process.env.TUYA_ACCESS_SECRET;
  const path = "/v1.0/token?grant_type=1";
  const t = Date.now().toString();
  const sign = signTokenRequest(clientId, secret, t, path);

  const response = await fetch(`${TUYA_BASE_URL}${path}`, {
    method: "GET",
    headers: {
      client_id: clientId,
      t,
      sign_method: "HMAC-SHA256",
      sign,
    },
    cache: "no-store",
  });

  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result.msg || "Autenticazione Tuya fallita.");
  }
  return result.result.access_token;
}

async function tuyaGet(path, token) {
  const clientId = process.env.TUYA_ACCESS_ID;
  const secret = process.env.TUYA_ACCESS_SECRET;
  const t = Date.now().toString();
  const sign = signBusinessRequest(clientId, secret, token, t, path);

  const response = await fetch(`${TUYA_BASE_URL}${path}`, {
    method: "GET",
    headers: {
      client_id: clientId,
      access_token: token,
      t,
      sign_method: "HMAC-SHA256",
      sign,
      "Content-Type": "application/json",
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
    const requestedDays = Number(searchParams.get("days")) || 90;
    const days = Math.min(Math.max(requestedDays, 1), 180);
    const endTime = Date.now();
    const startTime = endTime - days * 24 * 60 * 60 * 1000;
    const token = await getToken();

    // Keep the same parameter order as Tuya API Explorer. The comma is
    // percent-encoded on the wire and decoded only for the signature.
    const query = `codes=switch%2Cvalve_status&end_time=${endTime}&size=100&start_time=${startTime}`;
    const path = `/v2.0/cloud/thing/${DEVICE_ID}/report-logs?${query}`;
    const result = await tuyaGet(path, token);

    if (!result.success) {
      return NextResponse.json(
        { error: result.msg || "Errore nello storico Tuya.", tuya: result },
        { status: 500 }
      );
    }

    const logs = Array.isArray(result.result?.logs) ? result.result.logs : [];
    const events = logs
      .filter((log) => log.code === "switch" || log.code === "valve_status")
      .map((log) => {
        const eventTime = Number(log.event_time);
        return {
          id: `${eventTime}-${log.code}`,
          date: Number.isFinite(eventTime) ? new Date(eventTime).toISOString() : null,
          eventTime,
          code: log.code,
          value: log.value === true || log.value === "true",
        };
      })
      .filter((event) => Number.isFinite(event.eventTime) && event.date !== null)
      .sort((a, b) => b.eventTime - a.eventTime);

    return NextResponse.json({
      success: true,
      deviceId: DEVICE_ID,
      days,
      startTime,
      endTime,
      hasMore: result.result?.has_more === true,
      logCount: logs.length,
      events,
    });
  } catch (error) {
    console.error("Errore storico irrigazione:", error);
    return NextResponse.json({ error: error?.message || "Errore interno." }, { status: 500 });
  }
}
