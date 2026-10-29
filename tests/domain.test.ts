import { describe, it, expect } from "vitest";
import {
  splitFare,
  canTransition,
  boatSchema,
  bookingSchema,
  authSchema,
  scheduleSchema,
} from "../packages/shared/src/index";
describe("Financial calculations", () => {
  it("records 10 percent commission in centavos", () =>
    expect(splitFare(150000, 1000)).toEqual({
      base: 150000,
      commission: 15000,
      operator: 135000,
      serviceFee: 0,
      total: 150000,
    }));
  it("rounds half centavo up", () =>
    expect(splitFare(5, 1000).commission).toBe(1));
  it("discloses fixed passenger fee", () =>
    expect(splitFare(150000, 1000, 2000).total).toBe(152000));
  it.each([-1, 1.1, NaN, Infinity])("rejects invalid minor amount %s", (v) =>
    expect(() => splitFare(v, 1000)).toThrow(),
  );
  it("rejects invalid rate", () =>
    expect(() => splitFare(100, 10001)).toThrow());
});
describe("Validation and state machine", () => {
  it("public registration excludes administrator role", () =>
    expect(
      authSchema.safeParse({
        email: "test@example.com",
        password: "longpassword",
        role: "admin",
      }).success,
    ).toBe(false));
  it("rejects booking without policy acceptance", () =>
    expect(
      bookingSchema.safeParse({
        schedule_id: crypto.randomUUID(),
        passenger_count: 1,
        idempotency_key: crypto.randomUUID(),
        policy_accepted: false,
      }).success,
    ).toBe(false));
  it("rejects fractional passengers", () =>
    expect(
      bookingSchema.safeParse({
        schedule_id: crypto.randomUUID(),
        passenger_count: 1.5,
        idempotency_key: crypto.randomUUID(),
        policy_accepted: true,
      }).success,
    ).toBe(false));
  it("rejects impossible boat capacity", () =>
    expect(
      boatSchema.safeParse({
        name: "Boat",
        boat_type: "speedboat",
        capacity: 201,
        home_location_id: crypto.randomUUID(),
        seat_price: 1,
        charter_price: 1,
      }).success,
    ).toBe(false));
  it("allows payment after owner acceptance", () =>
    expect(canTransition("awaiting_payment", "confirmed")).toBe(true));
  it("blocks completion of unpaid trip", () =>
    expect(canTransition("awaiting_payment", "completed")).toBe(false));
  it("does not revive refunded booking", () =>
    expect(canTransition("refunded", "confirmed")).toBe(false));
  it("rejects reversed schedule times", () =>
    expect(
      scheduleSchema.safeParse({
        boat_id: crypto.randomUUID(),
        route_id: crypto.randomUUID(),
        starts_at: "2026-10-30T10:00:00Z",
        ends_at: "2026-10-30T09:00:00Z",
        mode: "seat",
        capacity: 1,
        price_minor: 100,
      }).success,
    ).toBe(false));
});
