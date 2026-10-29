import { createClient } from "npm:@supabase/supabase-js@2.118.0";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function env(key: string) {
  const value = Deno.env.get(key);
  if (!value)
    throw new HttpError(503, `Service awaiting configuration: ${key}`);
  return value;
}
export const service = () =>
  createClient(
    env("SUPABASE_URL"),
    Deno.env.get("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
export function userClient(req: Request) {
  return createClient(
    env("SUPABASE_URL"),
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || env("SUPABASE_ANON_KEY"),
    {
      global: {
        headers: { Authorization: req.headers.get("Authorization") || "" },
      },
      auth: { persistSession: false },
    },
  );
}
export async function auth(req: Request, admin = false) {
  const client = userClient(req);
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new HttpError(401, "Sign in required");
  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("role,account_status")
    .eq("id", data.user.id)
    .single();
  if (
    profileError ||
    !profile ||
    profile.account_status !== "active" ||
    (admin && profile.role !== "admin")
  )
    throw new HttpError(403, "Access denied");
  const { data: allowed, error: limitError } = await service().rpc(
    "consume_rate_limit",
    { p_user: data.user.id, p_bucket: new URL(req.url).pathname, p_limit: 20 },
  );
  if (limitError) throw new HttpError(503, "Request limit service unavailable");
  if (!allowed)
    throw new HttpError(429, "Too many requests. Please wait a minute.");
  return { client, user: data.user };
}
export function checked<T>({
  data,
  error,
}: {
  data: T;
  error: unknown;
}): NonNullable<T> {
  if (error)
    throw new HttpError(
      400,
      error instanceof Error
        ? error.message
        : (error as { message?: string }).message || "Operation rejected",
    );
  if (data === null) throw new HttpError(404, "Record not found");
  return data as NonNullable<T>;
}
export function serve(
  handler: (req: Request) => Promise<unknown>,
  webhook = false,
) {
  Deno.serve(async (req) => {
    const origin = req.headers.get("origin");
    const allowed = (Deno.env.get("ALLOWED_ORIGINS") || "")
      .split(",")
      .map((s) => s.trim());
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Vary: "Origin",
      "Access-Control-Allow-Headers":
        "authorization, apikey, x-client-info, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    };
    if (origin && allowed.includes(origin))
      headers["Access-Control-Allow-Origin"] = origin;
    if (origin && !allowed.includes(origin))
      return new Response(JSON.stringify({ error: "Origin not allowed" }), {
        status: 403,
        headers,
      });
    if (req.method === "OPTIONS")
      return new Response(null, { status: 204, headers });
    try {
      if (req.method !== "POST") throw new HttpError(405, "POST required");
      if (Number(req.headers.get("content-length") || 0) > 262144)
        throw new HttpError(413, "Request too large");
      const result = await handler(req);
      return new Response(JSON.stringify(result), { headers });
    } catch (e) {
      const code = e instanceof HttpError ? e.status : 400;
      return new Response(
        JSON.stringify({
          error:
            e instanceof HttpError
              ? e.message
              : webhook
                ? "Webhook verification failed"
                : "Request invalid or could not be completed",
        }),
        { status: code, headers },
      );
    }
  });
}
