import { NextResponse } from "next/server";
import crypto from "crypto";

const TUYA_BASE_URL = "https://openapi.tuyaeu.com";
const DEVICE_ID = "bf4f9c13a84f59ac39dybk";

async function getTuyaToken() {
  const clientId = process.env.TUYA_ACCESS_ID;
  const clientSecret = process.env.TUYA_ACCESS_SECRET;

  const t = Date.now().toString();
  const path = "/v1.0/token?grant_type=1";

  const contentHash = crypto
    .createHash("sha256")
    .update("")
    .digest("hex");

  const stringToSign = `GET\n${contentHash}\n\n${path}`;
  const sign = crypto
    .createHmac("sha256", clientSecret)
    .update(clientId + t + stringToSign)
    .digest("hex")
    .toUpperCase();

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

  if (!result.success) {
    throw new Error(
      result.msg || "Autenticazione Tuya fallita."
    );
  }

  return result.result.access_token;
}

async function tuyaRequest(method, path, body, accessToken) {
  const clientId = process.env.TUYA_ACCESS_ID;
  const clientSecret = process.env.TUYA_ACCESS_SECRET;

  const t = Date.now().toString();

  const contentHash = crypto
    .createHash("sha256")
    .update(body || "")
    .digest("hex");

  const stringToSign = [
    method.toUpperCase(),
    contentHash,
    "",
    path,
  ].join("\n");

  const sign = crypto
    .createHmac("sha256", clientSecret)
    .update(clientId + accessToken + t + stringToSign)
    .digest("hex")
    .toUpperCase();

  const response = await fetch(
    `${TUYA_BASE_URL}${path}`,
    {
      method,
      headers: {
        client_id: clientId,
        access_token: accessToken,
        t,
        sign_method: "HMAC-SHA256",
        sign,
        "Content-Type": "application/json",
      },
      body,
      cache: "no-store",
    }
  );

  return await response.json();
}

export async function POST(request) {
  try {
    const { user } = await (async () => {
      const { createClient } = await import(
        "../../../../lib/supabase/server"
      );

      const supabase = await createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      return { user };
    })();

    if (!user) {
      return NextResponse.json(
        { error: "Non autenticato" },
        { status: 401 }
      );
    }

    const body = await request.json();

    if (typeof body.switch !== "boolean") {
      return NextResponse.json(
        {
          error:
            "Il parametro switch deve essere true oppure false.",
        },
        { status: 400 }
      );
    }

    const accessToken = await getTuyaToken();

    const properties = JSON.stringify({
      switch: body.switch,
    });

    const payload = JSON.stringify({
      properties,
    });

    const path =
      `/v2.0/cloud/thing/${DEVICE_ID}/shadow/properties/issue`;

    const result = await tuyaRequest(
      "POST",
      path,
      payload,
      accessToken
    );

    if (!result.success) {
      return NextResponse.json(
        {
          error:
            result.msg ||
            "Errore durante il comando Tuya.",
          tuya: result,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      deviceId: DEVICE_ID,
      switch: body.switch,
      tuya: result,
    });
  } catch (error) {
    console.error(
      "Errore controllo irrigazione:",
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
