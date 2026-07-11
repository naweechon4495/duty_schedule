const SESSION_COOKIE = 'session';
const STATE_COOKIE = 'line_oauth_state';
const SESSION_MAX_AGE = 12 * 60 * 60;
const STATE_MAX_AGE = 300;

function bytesToBase64Url(bytes) {
  let bin = '';
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function base64UrlToBytes(b64url) {
  let b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
function textToBase64Url(str) {
  return bytesToBase64Url(new TextEncoder().encode(str));
}
function base64UrlToText(b64url) {
  return new TextDecoder().decode(base64UrlToBytes(b64url));
}

async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

async function signSession(payload, secret) {
  const encHeader = textToBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const encPayload = textToBase64Url(JSON.stringify(payload));
  const data = encHeader + '.' + encPayload;
  const key = await hmacKey(secret);
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return data + '.' + bytesToBase64Url(new Uint8Array(sigBuf));
}

async function verifySession(token, secret) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [encHeader, encPayload, sig] = parts;
  const key = await hmacKey(secret);
  const valid = await crypto.subtle.verify('HMAC', key, base64UrlToBytes(sig), new TextEncoder().encode(encHeader + '.' + encPayload));
  if (!valid) return null;
  let payload;
  try { payload = JSON.parse(base64UrlToText(encPayload)); } catch (e) { return null; }
  if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return null;
  return payload;
}

function parseCookies(request) {
  const header = request.headers.get('Cookie') || '';
  const cookies = {};
  header.split(';').forEach(pair => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const k = pair.slice(0, idx).trim();
    const v = pair.slice(idx + 1).trim();
    if (k) cookies[k] = decodeURIComponent(v);
  });
  return cookies;
}

function buildSetCookie(name, value, { maxAge, sameSite = 'Lax' } = {}) {
  let str = name + '=' + encodeURIComponent(value) + '; Path=/; HttpOnly; Secure; SameSite=' + sameSite;
  if (maxAge !== undefined) str += '; Max-Age=' + maxAge;
  return str;
}

function randomState() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function jsonResponse(obj, init) {
  return new Response(JSON.stringify(obj), { ...init, headers: { 'Content-Type': 'application/json', ...(init && init.headers) } });
}

function redirect(location, extraCookies) {
  const headers = new Headers({ Location: location });
  (extraCookies || []).forEach(c => headers.append('Set-Cookie', c));
  return new Response(null, { status: 302, headers });
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

// GET /api/data - browser reads the shared Sheet through the Worker so
// APPS_SCRIPT_TOKEN never has to be sent to (or stored in) the client.
async function handleApiDataGet(env) {
  const data = await fetchRemoteData(env);
  return jsonResponse(data);
}

// POST /api/data - browser sends {nurses, schedule, swaps, customHolidays, users}
// with no token; the Worker attaches APPS_SCRIPT_TOKEN server-side before writing.
async function handleApiDataPost(request, env) {
  let body;
  try { body = await request.json(); } catch (e) { return jsonResponse({ error: 'invalid_json' }, { status: 400 }); }
  const result = await pushRemoteData(env, body);
  return jsonResponse(result);
}

// GET /auth/line/login[?link=1]
async function handleLineLogin(request, env) {
  const url = new URL(request.url);
  const isLink = url.searchParams.get('link') === '1';
  // the .login/.link suffix lets the callback know which flow this was without a second cookie
  const state = randomState() + (isLink ? '.link' : '.login');
  const redirectUri = url.origin + '/auth/line/callback';

  const authorizeUrl = new URL('https://access.line.me/oauth2/v2.1/authorize');
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('client_id', env.LINE_CHANNEL_ID);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('state', state);
  authorizeUrl.searchParams.set('scope', 'profile openid');

  return redirect(authorizeUrl.toString(), [buildSetCookie(STATE_COOKIE, state, { maxAge: STATE_MAX_AGE })]);
}

// GET /auth/line/callback?code=&state=
async function handleLineCallback(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookies = parseCookies(request);
  const savedState = cookies[STATE_COOKIE];
  const clearState = buildSetCookie(STATE_COOKIE, '', { maxAge: 0 });

  if (!code || !state || !savedState || state !== savedState) {
    return redirect('/?login_error=state_mismatch', [clearState]);
  }

  const isLink = state.endsWith('.link');
  const redirectUri = url.origin + '/auth/line/callback';

  const tokenRes = await fetch('https://api.line.me/oauth2/v2.1/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: env.LINE_CHANNEL_ID,
      client_secret: env.LINE_CHANNEL_SECRET
    })
  });
  if (!tokenRes.ok) return redirect('/?login_error=token_exchange_failed', [clearState]);
  const tokenData = await tokenRes.json();

  const profileRes = await fetch('https://api.line.me/v2/profile', {
    headers: { Authorization: 'Bearer ' + tokenData.access_token }
  });
  if (!profileRes.ok) return redirect('/?login_error=profile_failed', [clearState]);
  const profile = await profileRes.json();

  const remoteData = await fetchRemoteData(env);
  if (remoteData.error) return redirect('/?login_error=backend_unavailable', [clearState]);
  const users = remoteData.users || [];

  if (isLink) {
    const sessionToken = cookies[SESSION_COOKIE];
    const session = sessionToken ? await verifySession(sessionToken, env.SESSION_SECRET) : null;
    if (!session) return redirect('/?login_error=must_login_first', [clearState]);

    const idx = users.findIndex(u => u.username === session.sub);
    if (idx === -1) return redirect('/?login_error=user_not_found', [clearState]);

    users[idx].lineUserId = profile.userId;
    await pushRemoteData(env, { users });
    return redirect('/?linked=1', [clearState]);
  }

  const matched = users.find(u => u.lineUserId && u.lineUserId === profile.userId);
  if (!matched) return redirect('/?login_error=unlinked', [clearState]);

  const nowSec = Math.floor(Date.now() / 1000);
  const sessionJWT = await signSession({
    sub: matched.username,
    role: matched.role,
    fullname: matched.fullname,
    lineUserId: profile.userId,
    iat: nowSec,
    exp: nowSec + SESSION_MAX_AGE
  }, env.SESSION_SECRET);

  return redirect('/', [buildSetCookie(SESSION_COOKIE, sessionJWT, { maxAge: SESSION_MAX_AGE }), clearState]);
}

// GET /auth/me
async function handleMe(request, env) {
  const cookies = parseCookies(request);
  const session = await verifySession(cookies[SESSION_COOKIE], env.SESSION_SECRET);
  if (!session) return jsonResponse({ loggedIn: false });
  return jsonResponse({ loggedIn: true, username: session.sub, fullname: session.fullname, role: session.role });
}

// POST /auth/logout
function handleLogout() {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  headers.append('Set-Cookie', buildSetCookie(SESSION_COOKIE, '', { maxAge: 0 }));
  return new Response(JSON.stringify({ ok: true }), { headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/auth/line/login' && request.method === 'GET') return handleLineLogin(request, env);
      if (url.pathname === '/auth/line/callback' && request.method === 'GET') return handleLineCallback(request, env);
      if (url.pathname === '/auth/me' && request.method === 'GET') return handleMe(request, env);
      if (url.pathname === '/auth/logout' && request.method === 'POST') return handleLogout();
      if (url.pathname === '/api/data' && request.method === 'GET') return handleApiDataGet(env);
      if (url.pathname === '/api/data' && request.method === 'POST') return handleApiDataPost(request, env);
    } catch (err) {
      return jsonResponse({ error: 'internal_error', message: err.message }, { status: 500 });
    }
    // Safety-net fallback; run_worker_first is scoped to /auth/* so static assets normally
    // never reach the Worker at all.
    return env.ASSETS.fetch(request);
  }
};
