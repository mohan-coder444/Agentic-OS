// Single source of truth for session cookie attributes.
//
// Why this file exists: browsers only clear a cookie when the clearing call
// uses the SAME sameSite/secure/path attributes it was set with. Keeping set
// and clear in one place stops logout from silently failing.
//
// Two modes:
//   local  (default)  -> sameSite:"lax",  secure:false
//                        Works for localhost:5173 -> localhost:8000 (same-site,
//                        different port). No HTTPS needed.
//   cross-site        -> sameSite:"none", secure:true
//                        Required when the frontend is on a different site than
//                        the API (e.g. *.vercel.app -> *.trycloudflare.com).
//                        Browsers REJECT sameSite:"none" without secure:true,
//                        so this mode only works over HTTPS.
//
// Enable cross-site mode with CROSS_SITE_COOKIES=true in the auth service env.
//
// NOTE: these are functions, not top-level consts, on purpose. ESM imports are
// hoisted and evaluated BEFORE index.js calls dotenv.config(), so reading
// process.env at module scope would always see undefined in local dev. Same
// trap that shared/redis/redis.js documents with its lazy init().

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

function isCrossSite() {
  return process.env.CROSS_SITE_COOKIES === "true";
}

// Attributes shared by set and clear. Must match exactly or clearing no-ops.
function baseCookieOptions() {
  const crossSite = isCrossSite();
  return {
    httpOnly: true,
    secure: crossSite,
    sameSite: crossSite ? "none" : "lax",
    path: "/",
  };
}

export function sessionCookieOptions() {
  return { ...baseCookieOptions(), maxAge: SESSION_TTL_SECONDS * 1000 };
}

// clearCookie must NOT include maxAge/expires — only the matching attributes.
export function clearCookieOptions() {
  return baseCookieOptions();
}

export const SESSION_TTL = SESSION_TTL_SECONDS;

export function logCookieMode() {
  console.log(
    `[auth] session cookies: ${
      isCrossSite()
        ? "cross-site (sameSite=none; Secure — requires HTTPS)"
        : "local (sameSite=lax)"
    }`
  );
}
