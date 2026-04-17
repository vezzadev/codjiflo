import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatTimeAgo, formatTimeUntil } from "./time";

const FIXED_NOW = new Date("2026-01-15T12:00:00Z").getTime();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("formatTimeAgo", () => {
  it("returns just now for recent dates", () => {
    expect(formatTimeAgo(new Date(FIXED_NOW))).toBe("just now");
  });

  it("returns singular minute for 1 minute ago", () => {
    expect(formatTimeAgo(new Date(FIXED_NOW - 60_000))).toBe("1 minute ago");
  });

  it("returns minutes for short durations", () => {
    expect(formatTimeAgo(new Date(FIXED_NOW - 5 * 60_000))).toBe("5 minutes ago");
  });

  it("returns singular hour for 1 hour ago", () => {
    expect(formatTimeAgo(new Date(FIXED_NOW - 3_600_000))).toBe("1 hour ago");
  });

  it("returns hours for longer durations", () => {
    expect(formatTimeAgo(new Date(FIXED_NOW - 2 * 3_600_000))).toBe("2 hours ago");
  });

  it("returns singular day for 1 day ago", () => {
    expect(formatTimeAgo(new Date(FIXED_NOW - 86_400_000))).toBe("1 day ago");
  });

  it("returns days for durations less than 30 days", () => {
    expect(formatTimeAgo(new Date(FIXED_NOW - 15 * 86_400_000))).toBe("15 days ago");
  });

  it("returns singular month for 1 month ago", () => {
    expect(formatTimeAgo(new Date(FIXED_NOW - 32 * 86_400_000))).toBe("1 month ago");
  });

  it("returns months for durations less than 12 months", () => {
    expect(formatTimeAgo(new Date(FIXED_NOW - 6 * 30 * 86_400_000))).toBe("6 months ago");
  });

  it("returns singular year for 1 year ago", () => {
    expect(formatTimeAgo(new Date(FIXED_NOW - 13 * 30 * 86_400_000))).toBe("1 year ago");
  });

  it("returns years for very long durations", () => {
    expect(formatTimeAgo(new Date(FIXED_NOW - 3 * 365 * 86_400_000))).toBe("3 years ago");
  });
});

describe("formatTimeUntil", () => {
  it("returns less than a minute for near-future dates", () => {
    expect(formatTimeUntil(new Date(FIXED_NOW + 20_000))).toBe("less than a minute");
  });

  it("returns less than a minute for past dates", () => {
    expect(formatTimeUntil(new Date(FIXED_NOW - 5_000))).toBe("less than a minute");
  });

  it("returns singular minute for 1 minute from now", () => {
    expect(formatTimeUntil(new Date(FIXED_NOW + 60_000))).toBe("1 minute");
  });

  it("returns minutes for short durations", () => {
    expect(formatTimeUntil(new Date(FIXED_NOW + 5 * 60_000))).toBe("5 minutes");
  });

  it("returns 34 minutes for 34 minutes from now", () => {
    expect(formatTimeUntil(new Date(FIXED_NOW + 34 * 60_000))).toBe("34 minutes");
  });

  it("returns singular hour for 1 hour from now", () => {
    expect(formatTimeUntil(new Date(FIXED_NOW + 3_600_000))).toBe("1 hour");
  });

  it("returns hours for longer durations", () => {
    expect(formatTimeUntil(new Date(FIXED_NOW + 2 * 3_600_000))).toBe("2 hours");
  });

  it("returns singular day for 1 day from now", () => {
    expect(formatTimeUntil(new Date(FIXED_NOW + 86_400_000))).toBe("1 day");
  });

  it("returns days for multi-day durations", () => {
    expect(formatTimeUntil(new Date(FIXED_NOW + 3 * 86_400_000))).toBe("3 days");
  });
});
