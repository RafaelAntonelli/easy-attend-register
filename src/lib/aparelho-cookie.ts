// HTTPS device cookies are partitioned by the top-level site so embedded
// previews retain their own device without sharing it with other sites.
export function opcoesCookieAparelho(url: string) {
  const secure = new URL(url).protocol === "https:";
  return {
    httpOnly: true,
    secure,
    sameSite: secure ? "none" as const : "lax" as const,
    ...(secure ? { partitioned: true } : {}),
    path: "/",
    maxAge: 180 * 86400,
  };
}