import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "../../../../lib/supabase/server";

const DEVICE_ID = "bf4f9c13a84f59ac39dybk";
const BASE = "https://openapi.tuyaeu.com";
const PROGRAM_CODES = [
  "water_program1",
  "water_program2",
  "water_program3",
  "water_program4",
];

function sign(secret, text) {
  return crypto
    .createHmac("sha256", secret)
    .update(text)
    .digest("hex")
    .toUpperCase();
}

async function tuyaRequest(method, path, token = "") {
  const clientId = process.env.TUYA_ACCESS_ID;
  const secret = process.env.TUYA_ACCESS_SECRET;
  const t = Date.now().toString();

  const bodyHash = crypto
    .createHash("sha256")
    .update("")
    .digest("hex");

  const stringToSign =
    `${method}\n${bodyHash}\n\n${path}`;

  const signText =
    clientId +
    token +
    t +
    stringToSign;

  const response = await fetch(
    `${BASE}${path}`,
    {
      method,
      headers: {
        client_id: clientId,
        access_token: token,
        t,
        sign_method: "HMAC-SHA256",
        sign: sign(secret, signText),
      },
      cache: "no-store",
    }
  );

  return response.json();
}

async function getToken() {
  const result = await tuyaRequest(
    "GET",
    "/v1.0/token?grant_type=1"
  );

  if (!result.success) {
    throw new Error(
      result.msg ||
        "Autenticazione Tuya fallita"
    );
  }

  return result.result.access_token;
}

function decodeProgramBlock(bytes, dp, index) {
  if (bytes.length < 18) {
    return null;
  }

  const id = bytes[0];
  const recurrenceType = bytes[1];
  const recurrenceValue = bytes[2];

  let intervalDays = null;

  if (recurrenceType === 1 && bytes[13] === 1) {
    const intervalCode = bytes[14];

    if (
      Number.isInteger(intervalCode) &&
      intervalCode >= 1
    ) {
      intervalDays = intervalCode + 1;
    }
  }

  if (recurrenceType === 4) {
    const intervalCode = bytes[8];

    if (
      Number.isInteger(intervalCode) &&
      intervalCode >= 1
    ) {
      intervalDays = intervalCode + 1;
    }
  }

  let weekdayMask = 0;
  let weekdays = [];

  if (recurrenceType === 1) {
    const recurrenceMode = bytes[13] ?? 0;

    if (recurrenceMode === 1) {
      const intervalCode = bytes[14] ?? null;

      if (Number.isInteger(intervalCode)) {
        intervalDays = intervalCode + 1;
      }
    }

    if (recurrenceMode === 2) {
      weekdayMask = bytes[17] ?? 0;

      for (let day = 0; day < 7; day++) {
        if (weekdayMask & (1 << day)) {
          weekdays.push(day);
        }
      }
    }
  }

  if (recurrenceType === 4) {
    const intervalCode = bytes[8] ?? null;

    if (Number.isInteger(intervalCode)) {
      intervalDays = intervalCode + 1;
    }
  }

  const timeMinutes =
    (bytes[3] << 8) |
    bytes[4];

  const duration =
    (bytes[5] << 8) |
    bytes[6];

  const validTime =
    timeMinutes >= 0 &&
    timeMinutes <= 1439;

  const validDuration =
    duration > 0 &&
    duration <= 1440;

  return {
    dp,
    index,
    id,
    enabled:
      bytes[1] !== 0,
    recurrenceType,
    recurrenceValue,
    intervalDays,
    weekdayMask,
    weekdays,
    timeMinutes:
      validTime
        ? timeMinutes
        : null,
    time:
      validTime
        ? `${String(
            Math.floor(timeMinutes / 60)
          ).padStart(2, "0")}:${String(
            timeMinutes % 60
          ).padStart(2, "0")}`
        : null,
    durationMinutes:
      validDuration
        ? duration
        : null,
    recurrenceBytes:
      bytes.slice(7),
    rawBytes:
      bytes,
    rawHex:
      Buffer.from(bytes)
        .toString("hex")
        .match(/.{1,2}/g)
        ?.join(" ") || "",
  };
}

function decodeDP(dp, value) {
  if (
    !value ||
    value === "AA=="
  ) {
    return {
      configured: false,
      records: [],
      raw: value || null,
    };
  }

  const buffer =
    Buffer.from(value, "base64");

  const bytes = [...buffer];
  const records = [];

  for (
    let offset = 0;
    offset + 18 <= bytes.length;
    offset += 18
  ) {
    const block = bytes.slice(
      offset,
      offset + 18
    );

    const record =
      decodeProgramBlock(
        block,
        dp,
        records.length + 1
      );

    if (record) {
      records.push({
        ...record,
        tuyaBlockOffset: offset,
      });
    }
  }

  return {
    configured: true,
    recordCount:
      records.length,
    records,
    byteLength:
      bytes.length,
    raw: value,
    hex:
      buffer
        .toString("hex")
        .match(/.{1,2}/g)
        ?.join(" ") || "",
    bytes,
  };
}

function normalizeTimerDate(value) {
  if (!value || value === "00000000") {
    return null;
  }

  const match = String(value).match(
    /^(\d{4})(\d{2})(\d{2})$/
  );

  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day)
  );

  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day)
  ) {
    return null;
  }

  return `${year}-${month}-${day}`;
}

function timerMatchesRecord(timer, record) {
  if (!Array.isArray(timer?.functions)) {
    return false;
  }

  return timer.functions.some((fn) => {
    if (fn?.code !== record.dp) {
      return false;
    }

    const value = fn?.value;

    if (value === record.raw) {
      return true;
    }

    if (
      value &&
      typeof value === "object"
    ) {
      return (
        value.value === record.raw ||
        value.raw === record.raw
      );
    }

    return false;
  });
}

function attachTimerDates(records, timers) {
  if (!Array.isArray(timers) || timers.length === 0) {
    return records;
  }

  return records.map((record) => {
    const timer = timers.find((item) =>
      timerMatchesRecord(item, record)
    );

    if (!timer) {
      return record;
    }

    return {
      ...record,
      startDate:
        normalizeTimerDate(timer.date),
      timerId:
        timer.timer_id ||
        timer.time_id ||
        null,
      timerLoops:
        timer.loops || null,
      timerTimezone:
        timer.timezone_id || null,
    };
  });
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
        { status: 401 }
      );
    }

    const token =
      await getToken();

    const path =
      `/v2.0/cloud/thing/${DEVICE_ID}/shadow/properties`;

    const result =
      await tuyaRequest(
        "GET",
        path,
        token
      );

    if (!result.success) {
      return NextResponse.json(
        {
          error:
            result.msg ||
            "Errore lettura Tuya",
          tuya: result,
        },
        { status: 500 }
      );
    }

    const properties =
      result.result?.properties ||
      [];

    const values = {};

    for (const item of properties) {
      values[item.code] =
        item.value;
    }

    const decoded = {};

    for (const code of PROGRAM_CODES) {
      decoded[code] =
        decodeDP(
          code,
          values[code]
        );
    }

    /*
     * La data di inizio della ricorrenza non è presente
     * nei 18 byte del DP water_programX. Tuya espone però
     * i timer reali del dispositivo tramite il Device Timer
     * API, inclusa la loro data di partenza.
     *
     * Questo permette al calendario di seguire automaticamente
     * i programmi creati/modificati nell'app Tuya, senza date
     * hardcoded e senza dover registrare manualmente ogni nuovo
     * programma.
     */
    let timers = [];

    try {
      const timersResult =
        await tuyaRequest(
          "GET",
          `/v2.0/cloud/timer/device/${DEVICE_ID}`,
          token
        );

      if (timersResult.success) {
        timers =
          timersResult.result || [];
      } else {
        console.warn(
          "Tuya Device Timer non disponibile:",
          timersResult
        );
      }
    } catch (timerError) {
      console.warn(
        "Errore lettura Tuya Device Timer:",
        timerError
      );
    }

    const records =
      PROGRAM_CODES.flatMap(
        (code) =>
          attachTimerDates(
            decoded[code].records,
            timers
          )
      );

    for (const code of PROGRAM_CODES) {
      decoded[code].records =
        records.filter(
          (record) => record.dp === code
        );
    }

    return NextResponse.json({
      success: true,
      deviceId:
        DEVICE_ID,
      programNum:
        values.program_num ??
        null,
      irriTime:
        values.irri_time ??
        null,
      programs:
        decoded,
      records,
      totalRecords:
        records.length,
      timers: timers.map((timer) => ({
        timerId:
          timer.timer_id ||
          timer.time_id ||
          null,
        aliasName:
          timer.alias_name || null,
        date:
          timer.date || null,
        time:
          timer.time || null,
        loops:
          timer.loops || null,
        enabled:
          timer.enable ?? null,
        timezoneId:
          timer.timezone_id || null,
        functions:
          timer.functions || [],
      })),
    });
  } catch (error) {
    console.error(
      "Errore programmi Tuya:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Errore interno",
      },
      { status: 500 }
    );
  }
}
