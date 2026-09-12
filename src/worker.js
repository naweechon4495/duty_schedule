// Cloudflare Worker — ตัวกลางระหว่างเบราว์เซอร์กับ Google Sheet (ผ่าน Apps Script)
// Apps Script URL + token เก็บเป็น Worker secret ฝั่งเซิร์ฟเวอร์ ไม่เคยส่งถึง client
//
// สองแอปแยกกัน แต่ใช้ Google Sheet เดียวกัน (คนละแท็บ) และแยก endpoint กันชัดเจน:
//   /api/data → ระบบพยาบาล  (คืน/รับเฉพาะ key ของพยาบาล)
//   /api/na   → ระบบผู้ช่วยพยาบาล NA (คืน/รับเฉพาะ key ของ NA)
// การกรอง key ทั้งฝั่งอ่านและเขียนทำให้ฝั่ง NA ไม่เห็นข้อมูลพยาบาลแม้แต่ระดับเครือข่าย
// และฝั่งพยาบาลก็ไม่เห็นข้อมูล NA เช่นกัน (customHolidays ใช้ร่วมกันได้ — เป็นข้อมูลวันหยุดกลาง)

// key ของแต่ละระบบ — ใช้กรองทั้ง GET (ก่อนส่งให้ client) และ POST (ก่อนเขียนลงชีต)
const NURSE_KEYS = ['nurses', 'schedule', 'swaps', 'customHolidays', 'users', 'leaves'];
const NA_KEYS = ['assistants', 'naSchedule', 'naSwaps', 'naLeaves', 'naUsers', 'customHolidays'];

function pick(obj, keys) {
  const out = {};
  if (!obj) return out;
  keys.forEach(k => { if (obj[k] !== undefined) out[k] = obj[k]; });
  return out;
}

function jsonResponse(obj, init) {
  return new Response(JSON.stringify(obj), { ...init, headers: { 'Content-Type': 'application/json', ...(init && init.headers) } });
}

async function fetchRemoteData(env) {
  const res = await fetch(env.APPS_SCRIPT_URL + '?token=' + encodeURIComponent(env.APPS_SCRIPT_TOKEN));
  return res.json();
}

async function pushRemoteData(env, data) {
  const res = await fetch(env.APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ token: env.APPS_SCRIPT_TOKEN, data })
  });
  return res.json();
}

// GET — อ่านข้อมูลจากชีตแล้วส่งเฉพาะ key ที่ระบบนั้นควรเห็น
async function handleDataGet(env, allowedKeys) {
  const data = await fetchRemoteData(env);
  if (data && data.error) return jsonResponse(data);
  return jsonResponse(pick(data, allowedKeys));
}

// POST — เขียนเฉพาะ key ที่ระบบนั้นเป็นเจ้าของ (กัน client ส่ง key ข้ามระบบมาเขียนทับ)
async function handleDataPost(request, env, allowedKeys) {
  let body;
  try { body = await request.json(); } catch (e) { return jsonResponse({ error: 'invalid_json' }, { status: 400 }); }
  const result = await pushRemoteData(env, pick(body, allowedKeys));
  return jsonResponse(result);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/api/data' && request.method === 'GET') return handleDataGet(env, NURSE_KEYS);
      if (url.pathname === '/api/data' && request.method === 'POST') return handleDataPost(request, env, NURSE_KEYS);
      // NA POST เขียนได้เฉพาะ key ของ NA จริง ๆ (customHolidays เป็นข้อมูลกลางฝั่งพยาบาลเป็นคนเขียน จึงไม่ให้ NA เขียน)
      if (url.pathname === '/api/na' && request.method === 'GET') return handleDataGet(env, NA_KEYS);
      if (url.pathname === '/api/na' && request.method === 'POST') return handleDataPost(request, env, ['assistants', 'naSchedule', 'naSwaps', 'naLeaves', 'naUsers']);
    } catch (err) {
      return jsonResponse({ error: 'internal_error', message: err.message }, { status: 500 });
    }
    // Safety-net fallback; run_worker_first is scoped to /api/* so static assets normally
    // never reach the Worker at all.
    return env.ASSETS.fetch(request);
  }
};
