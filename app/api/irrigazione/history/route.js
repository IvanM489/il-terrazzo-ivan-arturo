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
  const canonicalUrl = decodeURIComponent(path);
  return `${method.toUpperCase()}\n${EMPTY_BODY_SHA256}\n\n${canonicalUrl}`;
}

function signTokenRequest(clientId, secret, t, path) {
  return hmac(secret, `${clientId}${t}${buildStringToSign("GET", path)}`);
}

function signBusinessRequest(clientId, secret, token, t, path) {
  return hmac(secret, `${clientId}${token}${t}${buildStringToSign("GET", path)}`);
}

async function getToken() {
  const clientId = process.env.TUYA_ACCESS_ID;
  const secret = process.env.TUYA_ACCESS_SECRET;
  const path = "/v1.0/token?grant_type=1";
  const t = Date.now().toString();
  const sign = signTokenRequest(clientId, secret, t, path);

  const response = await fetch(`${TUYA_BASE_URL}${path}`, {
    method: "GET",
    headers: { client_id: clientId, t, sign_method: "HMAC-SHA256", sign },
    cache: "no-store",
  });

  const result = await response.json();
  if (!response.ok || !result.success) throw new Error(result.msg || "Autenticazione Tuya fallita.");
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

function buildIrrigationCycles(logs) {
  // Tuya reports both switch and valve_status. They describe the same
  // physical cycle, so the calendar must not count them twice.
  const valveLogs = logs
    .filter((log) => log.code === "valve_status")
    .map((log) => ({
      eventTime: Number(log.event_time),
      value: log.value === true || log.value === "true",
    }))
    .filter((log) => Number.isFinite(log.eventTime))
    .sort((a, b) => a.eventTime - b.eventTime);

  const cycles = [];
  let activeStart = null;

  for (const event of valveLogs) {
    if (event.value) {
      // Ignore duplicate ON notifications while the valve is already ON.
      if (activeStart === null) activeStart = event.eventTime;
      continue;
    }

    if (activeStart !== null) {
      const endTime = event.eventTime;
      cycles.push({
        id: `${activeStart}-irrigation`,
        date: new Date(activeStart).toISOString(),
        startTime: new Date(activeStart).toISOString(),
        endTime: new Date(endTime).toISOString(),
        eventTime: activeStart,
        endEventTime: endTime,
        durationMinutes: Math.max(0, Math.round((endTime - activeStart) / 60000)),
        code: "irrigation_cycle",
        value: true,
      });
      activeStart = null;
    }
  }

  // If the device is currently ON, keep the open cycle visible in the calendar.
  if (activeStart !== null) {
    cycles.push({
      id: `${activeStart}-irrigation-open`,
      date: new Date(activeStart).toISOString(),
      startTime: new Date(activeStart).toISOString(),
      endTime: null,
      eventTime: activeStart,
      endEventTime: null,
      durationMinutes: null,
      code: "irrigation_cycle",
      value: true,
      active: true,
    });
  }

  return cycles.sort((a, b) => b.eventTime - a.eventTime);
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
    const cycles = buildIrrigationCycles(logs);

    return NextResponse.json({
      success: true,
      deviceId: DEVICE_ID,
      days,
      startTime,
      endTime,
      hasMore: result.result?.has_more === true,
      logCount: logs.length,
      events: cycles,
      cycles,
      rawEventCount: logs.length,
    });
  } catch (error) {
    console.error("Errore storico irrigazione:", error);
    return NextResponse.json({ error: error?.message || "Errore interno." }, { status: 500 });
  }
}
