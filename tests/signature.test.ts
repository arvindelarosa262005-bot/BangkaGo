import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { validSignature } from "../supabase/functions/_shared/signature";
const secret = "test-only-webhook-secret";
const now = 1800000000000;
const time = String(now / 1000);
const raw = JSON.stringify({ data: { id: "evt_fixture" } });
const sig = (body = raw, t = time) =>
  createHmac("sha256", secret)
    .update(t + "." + body)
    .digest("hex");
describe("PayMongo raw webhook authentication", () => {
  it("accepts correctly signed test event", async () =>
    expect(
      await validSignature(
        raw,
        `t=${time},te=${sig()},li=`,
        secret,
        false,
        now,
      ),
    ).toBe(true));
  it("accepts correctly signed live event", async () =>
    expect(
      await validSignature(raw, `t=${time},te=,li=${sig()}`, secret, true, now),
    ).toBe(true));
  it("rejects wrong environment", async () =>
    expect(
      await validSignature(raw, `t=${time},te=${sig()},li=`, secret, true, now),
    ).toBe(false));
  it("rejects modified payload", async () =>
    expect(
      await validSignature(
        raw + " ",
        `t=${time},te=${sig()}`,
        secret,
        false,
        now,
      ),
    ).toBe(false));
  it("rejects expired timestamp", async () =>
    expect(
      await validSignature(
        raw,
        `t=${Number(time) - 301},te=${sig(raw, String(Number(time) - 301))}`,
        secret,
        false,
        now,
      ),
    ).toBe(false));
  it("rejects missing header", async () =>
    expect(await validSignature(raw, "", secret, false, now)).toBe(false));
  it("rejects malformed hexadecimal", async () =>
    expect(
      await validSignature(raw, `t=${time},te=ZZZZ`, secret, false, now),
    ).toBe(false));
  it("rejects different secret", async () =>
    expect(
      await validSignature(
        raw,
        `t=${time},te=${sig()}`,
        "another-secret",
        false,
        now,
      ),
    ).toBe(false));
});
