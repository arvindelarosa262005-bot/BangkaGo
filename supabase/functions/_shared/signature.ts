export async function validSignature(
  raw: string,
  header: string,
  secret: string,
  live: boolean,
  now = Date.now(),
) {
  const fields: Record<string, string> = Object.fromEntries(
    header.split(",").map((p) => p.trim().split("=")),
  );
  if (
    !/^\d+$/.test(fields.t ?? "") ||
    Math.abs(now / 1000 - Number(fields.t)) > 300
  )
    return false;
  const signature = fields[live ? "li" : "te"];
  if (!/^[a-f0-9]{64}$/i.test(signature ?? "")) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const bytes = new Uint8Array(
    signature.match(/../g)!.map((h) => parseInt(h, 16)),
  );
  return crypto.subtle.verify(
    "HMAC",
    key,
    bytes,
    new TextEncoder().encode(fields.t + "." + raw),
  );
}
