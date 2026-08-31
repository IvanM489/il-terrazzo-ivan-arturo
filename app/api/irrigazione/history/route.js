import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "../../../../lib/supabase/server";

const TUYA_BASE_URL = "https://openapi.tuyaeu.com";
const DEVICE_ID = "bf4f9c13a84f59ac39dybk";

function hmac(secret, value) {
  return crypto
    .createHmac("sha256", secret)
    .update(value)
    .digest("hex")
    .toUpperCase();
}

function sha256(value) {
  return crypto
    .createHash("sha256")
    .update(value)
    .digest("hex");
}

/**
 * Costruisce la firma Tuya.
 *
 * IMPORTANTE:
 * La query string utilizzata nella firma deve essere
 * esattamente la stessa che viene inviata nella richiesta.
 */
function buildTuyaSign({
  method,
  path,
  query,
  clientId,
  accessToken,
  timestamp,
  secret,
}) {
  const fullPath = query ? `${path}?${query}` : path;

  const bodyHash = sha256("");

  const stringToSign =
    `${method}\n` +
    `${bodyHash}\n` +
    `\n` +
    `${fullPath}`;

  const signText =
    clientId +
    accessToken +
    timestamp +
    stringToSign;

  return hmac(secret, signText);
}

async function getToken() {
  const clientId = process.env.TUYA_ACCESS_ID;
  const secret = process.env.TUYA_ACCESS_SECRET;

  if (!clientId || !secret) {
    throw new Error("Credenziali Tuya mancanti.");
  }

  const timestamp = Date.now().toString();
  const path = "/v1.0/token";
  const query = "grant_type=1";

  const sign = buildTuyaSign({
    method: "GET",
    path,
    query,
    clientId,
    accessToken: "",
    timestamp,
    secret,
  });

  const response = await fetch(
    `${TUYA_BASE_URL}${path}?${query}`,
    {
      method: "GET",
      headers: {
        client_id: clientId,
        t: timestamp,
        sign_method: "HMAC-SHA256",
        sign,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    }
  );

  const result = await response.json();

  if (!result.success) {
    throw new Error(
      result.msg || "Autenticazione Tuya fallita."
    );
  }

  return result.result.access_token;
}

async function tuyaGet(path, query, token) {
  const clientId = process.env.TUYA_ACCESS_ID;
  const secret = process.env.TUYA_ACCESS_SECRET;

  if (!clientId || !secret) {
    throw new Error("Credenziali Tuya mancanti.");
  }

  const timestamp = Date.now().toString();

  const sign = buildTuyaSign({
    method: "GET",
    path,
    query,
    clientId,
    accessToken: token,
    timestamp,
    secret,
  });

  const url = `${TUYA_BASE_URL}${path}?${query}`;

  console.log("[Tuya history] URL:", url);
  console.log("[Tuya history] timestamp:", timestamp);
  console.log("[Tuya history] sign:", sign);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      client_id: clientId,
      access_token: token,
      t: timestamp,
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

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Non autenticato" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);

    const requestedDays =
      Number(searchParams.get("days")) || 90;

    const days = Math.min(
      Math.max(requestedDays, 1),
      180
    );

    const endTime = Date.now();

    const startTime =
      endTime -
      days * 24 * 60 * 60 * 1000;

    const token = await getToken();

    /*
     * ATTENZIONE:
     * Manteniamo ESATTAMENTE l'ordine utilizzato
     * dalla chiamata funzionante del debugger Tuya:
     *
     * codes
     * end_time
     * size
     * start_time
     *
     * Inoltre encodeURIComponent() produce:
     * switch%2Cvalve_status
     */
    const query =
      `codes=${encodeURIComponent("switch,valve_status")}` +
      `&end_time=${endTime}` +
      `&size=100` +
      `&start_time=${startTime}`;

    const path =
      `/v2.0/cloud/thing/${DEVICE_ID}/report-logs`;

    const result = await tuyaGet(
      path,
      query,
      token
    );

    if (!result.success) {
      return NextResponse.json(
        {
          error:
            result.msg ||
            "Errore nello storico Tuya.",
          tuya: result,
        },
        { status: 500 }
      );
    }

    /*
     * Tuya può restituire:
     *
     * result.logs
     *
     * oppure, quando non ci sono eventi:
     *
     * result.has_more
     *
     * senza la proprietà logs.
     */
    const logs = Array.isArray(result.result?.logs)
      ? result.result.logs
      : [];

    const events = logs
      .filter(
        (log) =>
          log.code === "switch" ||
          log.code === "valve_status"
      )
      .map((log) => {
        const eventTime = Number(log.event_time);

        return {
          id: `${eventTime}-${log.code}`,
          date: Number.isFinite(eventTime)
            ? new Date(eventTime).toISOString()
            : null,
          eventTime,
          code: log.code,
          value:
            log.value === true ||
            log.value === "true",
        };
      })
      .filter(
        (event) =>
          Number.isFinite(event.eventTime) &&
          event.date !== null
      )
      .sort(
        (a, b) =>
          b.eventTime - a.eventTime
      );

    return NextResponse.json({
      success: true,
      deviceId: DEVICE_ID,
      days,
      startTime,
      endTime,
      hasMore:
        result.result?.has_more === true,
      logCount: logs.length,
      events,
    });
  } catch (error) {
    console.error(
      "Errore storico irrigazione:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Errore interno.",
      },
      { status: 500 }
    );
  }
}