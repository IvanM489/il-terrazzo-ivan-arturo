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
  return crypto.createHmac("sha256", secret).update(text).digest("hex").toUpperCase();
}

async function tuyaRequest(method, path, token = "") {
  const clientId = process.env.TUYA_ACCESS_ID;
  const secret = process.env.TUYA_ACCESS_SECRET;
  const t = Date.now().toString();
  const bodyHash = crypto.createHash("sha256").update("").digest("hex");
  const stringToSign = `${method}\n${bodyHash}\n\n${path}`;
  const signText = clientId + token + t + stringToSign;

  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      client_id: clientId,
      access_token: token,
      t,
      sign_method: "HMAC-SHA256",
      sign: sign(secret, signText),
    },
    cache: "no-store",
  });

  return response.json();
}

async function getToken() {
  const result = await tuyaRequest("GET", "/v1.0/token?grant_type=1");
  if (!result.success) throw new Error(result.msg || "Autenticazione Tuya fallita");
  return result.result.access_token;
}

function decodeProgramBlock(bytes, dp, index) {
  if (bytes.length < 18) return null;

  const recurrenceType = bytes[1];
  const recurrenceValue = bytes[2];
  let intervalDays = null;
  let weekdayMask = 0;
  const weekdays = [];

  // R2603: for the observed interval format, byte 13 selects the
  // interval-day mode and byte 14 stores N-1 (1=>2 days, 2=>3 days...).
  if (recurrenceType === 1 && bytes[13] === 1 && Number.isInteger(bytes[14])) {
    intervalDays = bytes[14] + 1;
  }

  if (recurrenceType === 4 && Number.isInteger(bytes[8]) && bytes[8] >= 1) {
    intervalDays = bytes[8] + 1;
  }

  if (recurrenceType === 1 && bytes[13] === 2) {
    weekdayMask = bytes[17] ?? 0;
    for (let day = 0; day < 7; day++) {
      if (weekdayMask & (1 << day)) weekdays.push(day);
    }
  }

  const timeMinutes = (bytes[3] << 8) | bytes[4];
  const duration = (bytes[5] << 8) | bytes[6];
  const validTime = timeMinutes >= 0 && timeMinutes <= 1439;
  const validDuration = duration > 0 && duration <= 1440;

  return {
    dp,
    index,
    id: bytes[0],
    enabled: bytes[1] !== 0,
    recurrenceType,
    recurrenceValue,
    intervalDays,
    weekdayMask,
    weekdays,
    timeMinutes: validTime ? timeMinutes : null,
    time: validTime
      ? `${String(Math.floor(timeMinutes / 60)).padStart(2, "0")}:${String(timeMinutes % 60).padStart(2, "0")}`
      : null,
    durationMinutes: validDuration ? duration : null,
    recurrenceBytes: bytes.slice(7),
    rawBytes: bytes,
    rawHex: Buffer.from(bytes).toString("hex").match(/.{1,2}/g)?.join(" ") || "",
  };
}

function decodeDP(dp, value) {
  if (!value || value === "AA==") return { configured: false, records: [], raw: value || null };

  const buffer = Buffer.from(value, "base64");
  const bytes = [...buffer];
  const records = [];

  for (let offset = 0; offset + 18 <= bytes.length; offset += 18) {
    const record = decodeProgramBlock(dp, records.length + 1, bytes.slice(offset, offset + 18));
    if (record) records.push({ ...record, tuyaBlockOffset: offset });
  }

  return {
    configured: true,
    recordCount: records.length,
    records,
    byteLength: bytes.length,
    raw: value,
    hex: buffer.toString("hex").match(/.{1,2}/g)?.join(" ") || "",
    bytes,
  };
}

// Kept separate because old Tuya timer APIs return several different shapes.
function flattenLegacyTimers(result) {
  const categories = Array.isArray(result) ? result : result && typeof result === "object" ? [result] : [];
  const timers = [];
  for (const category of categories) {
    for (const group of Array.isArray(category?.groups) ? category.groups : []) {
      for (const timer of Array.isArray(group?.timers) ? group.timers : []) timers.push(timer);
    }
  }
  return timers;
}

function normalizeTimerDate(value) {
  const match = String(value || "").match(/^(\d{4})(\d{2})(\d{2})$/);
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function timerMatchesRecord(timer, record) {
  if (!Array.isArray(timer?.functions)) return false;
  return timer.functions.some((fn) => {
    if (fn?.code !== record.dp) return false;
    const value = fn?.value;
    return value === record.raw || value?.value === record.raw || value?.raw === record.raw;
  });
}

function attachTimerDates(records, timers) {
  return records.map((record) => {
    const timer = timers.find((item) => timerMatchesRecord(item, record));
    if (!timer) return record;
    return {
      ...record,
      startDate: normalizeTimerDate(timer.date),
      timerId: timer.timer_id || timer.time_id || null,
      timerLoops: timer.loops || null,
      timerTimezone: timer.timezone_id || null,
      startDateSource: "tuya-device-timer",
    };
  });
}

async function getTimingLogs(token) {
  const endTime = Date.now();
  const startTime = endTime - 30 * 24 * 60 * 60 * 1000;
  const paths = [
    `/v2.0/cloud/thing/${DEVICE_ID}/logs?type=10&start_time=${startTime}&end_time=${endTime}&size=100`,
    `/v1.0/devices/${DEVICE_ID}/logs?type=10&start_time=${startTime}&end_time=${endTime}&size=100`,
  ];

  for (const path of paths) {
    try {
      const result = await tuyaRequest("GET", path, token);
      if (!result.success) continue;
      const logs = result.result?.logs;
      if (Array.isArray(logs)) return logs;
      const list = result.result?.list;
      if (Array.isArray(list)) return list;
    } catch {
      // Try the next compatible endpoint.
    }
  }
  return [];
}

async function getWateringHistory(token) {
  const endTime = Date.now();
  const startTime = endTime - 180 * 24 * 60 * 60 * 1000;
  const path = `/v2.0/cloud/thing/${DEVICE_ID}/report-logs?codes=switch,valve_status&start_time=${startTime}&end_time=${endTime}&size=100`;

  try {
    const result = await tuyaRequest("GET", path, token);
    if (!result.success || !Array.isArray(result.result?.logs)) return [];
    return result.result.logs
      .filter((log) => (log.code === "switch" || log.code === "valve_status") && (log.value === true || log.value === "true"))
      .map((log) => Number(log.event_time))
      .filter(Number.isFinite)
      .sort((a, b) => b - a);
  } catch {
    return [];
  }
}

function inferStartDatesFromHistory(records, historyTimes) {
  if (!historyTimes.length) return records;

  return records.map((record) => {
    if (record.startDate || !record.intervalDays || !record.time) return record;

    const [hours, minutes] = record.time.split(":").map(Number);
    const candidates = historyTimes.filter((timestamp) => {
      const date = new Date(timestamp);
      return date.getHours() === hours && date.getMinutes() === minutes;
    });

    if (!candidates.length) return record;

    // Any actual execution at the configured time establishes the phase of
    // an every-N-days local schedule. We use the latest execution as anchor.
    const anchor = new Date(candidates[0]);
    anchor.setHours(0, 0, 0, 0);

    return {
      ...record,
      startDate: `${anchor.getFullYear()}-${String(anchor.getMonth() + 1).padStart(2, "0")}-${String(anchor.getDate()).padStart(2, "0")}`,
      startDateSource: "tuya-watering-history",
      anchorEventTime: candidates[0],
    };
  });
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

    const token = await getToken();
    const path = `/v2.0/cloud/thing/${DEVICE_ID}/shadow/properties`;
    const result = await tuyaRequest("GET", path, token);
    if (!result.success) {
      return NextResponse.json({ error: result.msg || "Errore lettura Tuya", tuya: result }, { status: 500 });
    }

    const properties = result.result?.properties || [];
    const values = {};
    for (const item of properties) values[item.code] = item.value;

    const decoded = {};
    for (const code of PROGRAM_CODES) decoded[code] = decodeDP(code, values[code]);

    let timers = [];
    try {
      const timersResult = await tuyaRequest("GET", `/v2.0/cloud/timer/device/${DEVICE_ID}`, token);
      if (timersResult.success && Array.isArray(timersResult.result)) timers = timersResult.result;
    } catch {}

    if (!timers.length) {
      try {
        const legacy = await tuyaRequest("GET", `/v1.0/devices/${DEVICE_ID}/timers`, token);
        if (legacy.success) timers = flattenLegacyTimers(legacy.result);
      } catch {}
    }

    const timingLogs = await getTimingLogs(token);
    const wateringHistory = await getWateringHistory(token);

    let records = PROGRAM_CODES.flatMap((code) => attachTimerDates(decoded[code].records, timers));
    records = inferStartDatesFromHistory(records, wateringHistory);

    for (const code of PROGRAM_CODES) {
      decoded[code].records = records.filter((record) => record.dp === code);
    }

    return NextResponse.json({
      success: true,
      deviceId: DEVICE_ID,
      programNum: values.program_num ?? null,
      irriTime: values.irri_time ?? null,
      programs: decoded,
      records,
      totalRecords: records.length,
      timers: timers.map((timer) => ({
        timerId: timer.timer_id || timer.time_id || null,
        aliasName: timer.alias_name || null,
        date: timer.date || null,
        time: timer.time || null,
        loops: timer.loops || null,
        enabled: timer.enable ?? (timer.status === 1),
        timezoneId: timer.timezone_id || null,
        functions: timer.functions || [],
      })),
      timingLogs: timingLogs.map((log) => ({
        eventTime: log.event_time || null,
        code: log.code || null,
        eventId: log.event_id || null,
        eventFrom: log.event_from || null,
        value: log.value ?? log.event_value ?? null,
        status: log.status || null,
      })),
      wateringHistoryAnchors: wateringHistory.length,
    });
  } catch (error) {
    console.error("Errore programmi Tuya:", error);
    return NextResponse.json({ error: error?.message || "Errore interno" }, { status: 500 });
  }
}
