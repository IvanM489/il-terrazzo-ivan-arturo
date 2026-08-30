import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "../../../../lib/supabase/server";

const TUYA_ENDPOINT =
  process.env.TUYA_ENDPOINT || "https://openapi.tuyaeu.com";

const ACCESS_ID = process.env.TUYA_ACCESS_ID;
const ACCESS_SECRET = process.env.TUYA_ACCESS_SECRET;
const DEVICE_ID = process.env.TUYA_DEVICE_ID;

function sha256(value = "") {
  return crypto
    .createHash("sha256")
    .update(value)
    .digest("hex");
}

function hmacSha256(value) {
  return crypto
    .createHmac("sha256", ACCESS_SECRET)
    .update(value)
    .digest("hex")
    .toUpperCase();
}

function createTuyaSign({
  method,
  path,
  accessToken = "",
}) {
  const body = "";

  const contentHash = sha256(body);

  const stringToSign = [
    method.toUpperCase(),
    contentHash,
    "",
    path,
  ].join("\n");

  const t = Date.now().toString();
  const nonce = crypto.randomUUID();

  const signInput =
    ACCESS_ID +
    accessToken +
    t +
    nonce +
    stringToSign;

  return {
    sign: hmacSha256(signInput),
    t,
    nonce,
  };
}

async function getTuyaToken() {
  const path =
    "/v1.0/token?grant_type=1";

  const {
    sign,
    t,
    nonce,
  } = createTuyaSign({
    method: "GET",
    path,
  });

  const response = await fetch(
    `${TUYA_ENDPOINT}${path}`,
    {
      method: "GET",
      headers: {
        client_id: ACCESS_ID,
        sign,
        t,
        nonce,
        sign_method: "HMAC-SHA256",
        "Content-Type": "application/json",
      },
      cache: "no-store",
    }
  );

  const result = await response.json();

  if (!response.ok || !result.success) {
    console.error(
      "TUYA TOKEN ERROR:",
      result
    );

    throw new Error(
      `Autenticazione Tuya fallita: ${
        result.msg ||
        JSON.stringify(result)
      }`
    );
  }

  return result.result.access_token;
}

async function getDeviceStatus(
  accessToken
) {
  const path =
    `/v1.0/devices/${encodeURIComponent(
      DEVICE_ID
    )}/status`;

  const {
    sign,
    t,
    nonce,
  } = createTuyaSign({
    method: "GET",
    path,
    accessToken,
  });

  const response = await fetch(
    `${TUYA_ENDPOINT}${path}`,
    {
      method: "GET",
      headers: {
        client_id: ACCESS_ID,
        access_token: accessToken,
        sign,
        t,
        nonce,
        sign_method: "HMAC-SHA256",
        "Content-Type": "application/json",
      },
      cache: "no-store",
    }
  );

  const result = await response.json();

  if (!response.ok || !result.success) {
    console.error(
      "TUYA STATUS ERROR:",
      result
    );

    throw new Error(
      `Lettura dispositivo fallita: ${
        result.msg ||
        JSON.stringify(result)
      }`
    );
  }

  return result.result;
}

export async function GET() {
  try {
    const supabase =
      await createClient();

    const {
      data: { user },
    } =
      await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          error:
            "Non autenticato",
        },
        {
          status: 401,
        }
      );
    }

    if (
      !ACCESS_ID ||
      !ACCESS_SECRET ||
      !DEVICE_ID
    ) {
      return NextResponse.json(
        {
          error:
            "Configurazione Tuya incompleta nelle variabili d'ambiente.",
        },
        {
          status: 500,
        }
      );
    }

    const accessToken =
      await getTuyaToken();

    const status =
      await getDeviceStatus(
        accessToken
      );

    return NextResponse.json({
      success: true,
      deviceId: DEVICE_ID,
      status,
    });
  } catch (error) {
    console.error(
      "ERRORE API IRRIGAZIONE:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Errore interno.",
      },
      {
        status: 502,
      }
    );
  }
}
