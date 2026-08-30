import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "../../../../lib/supabase/server";

const ENDPOINT =
  process.env.TUYA_ENDPOINT || "https://openapi.tuyaeu.com";

const ACCESS_ID = process.env.TUYA_ACCESS_ID;
const ACCESS_SECRET = process.env.TUYA_ACCESS_SECRET;
const DEVICE_ID = process.env.TUYA_DEVICE_ID;

function sha256(value = "") {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function signRequest(method, path, token = "") {
  const t = Date.now().toString();
  const nonce = crypto.randomUUID();
  const bodyHash = sha256("");

  const stringToSign = [
    method,
    bodyHash,
    "",
    path,
  ].join("\n");

  const signInput =
    ACCESS_ID +
    token +
    t +
    nonce +
    stringToSign;

  const sign = crypto
    .createHmac("sha256", ACCESS_SECRET)
    .update(signInput)
    .digest("hex")
    .toUpperCase();

  return { t, nonce, sign };
}

async function getToken() {
  const path = "/v1.0/token?grant_type=1";

  const { t, nonce, sign } =
    signRequest("GET", path);

  const response = await fetch(
    `${ENDPOINT}${path}`,
    {
      headers: {
        client_id: ACCESS_ID,
        sign,
        t,
        nonce,
        sign_method: "HMAC-SHA256",
      },
      cache: "no-store",
    }
  );

  const result = await response.json();

  if (!result.success) {
    throw new Error(
      result.msg || "Errore autenticazione Tuya"
    );
  }

  return result.result.access_token;
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

    const token = await getToken();

    const path =
      `/v1.0/devices/${DEVICE_ID}/status`;

    const { t, nonce, sign } =
      signRequest(
        "GET",
        path,
        token
      );

    const response = await fetch(
      `${ENDPOINT}${path}`,
      {
        headers: {
          client_id: ACCESS_ID,
          access_token: token,
          sign,
          t,
          nonce,
          sign_method: "HMAC-SHA256",
        },
        cache: "no-store",
      }
    );

    const result = await response.json();

    if (!result.success) {
      throw new Error(
        result.msg ||
          "Errore lettura dispositivo"
      );
    }

    const status = result.result || [];

    const decoded = status.map((item) => {
      const output = {
        code: item.code,
        value: item.value,
        type: typeof item.value,
      };

      if (typeof item.value === "string") {
        try {
          const buffer =
            Buffer.from(
              item.value,
              "base64"
            );

          output.base64Length =
            item.value.length;

          output.hex =
            buffer.toString("hex");

          output.byteLength =
            buffer.length;

          output.bytes =
            [...buffer];

          if (
            buffer.length > 0 &&
            buffer.every(
              (byte) =>
                byte >= 32 &&
                byte <= 126
            )
          ) {
            output.ascii =
              buffer.toString("ascii");
          }
        } catch {
          // valore non Base64
        }
      }

      return output;
    });

    return NextResponse.json({
      success: true,
      deviceId: DEVICE_ID,
      status,
      decoded,
    });
  } catch (error) {
    console.error(
      "TUYA DEBUG ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Errore interno",
      },
      { status: 502 }
    );
  }
}
