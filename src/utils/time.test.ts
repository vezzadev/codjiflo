import { describe, expect, it } from "vitest";
import { formatTimeAgo, formatTimeUntil } from "./time";

describe("formatTimeAgo", () => {
  it("returns just now for recent dates", () => {
    const now = new Date();
    expect(formatTimeAgo(now)).toBe("just now");
  });

  it("returns singular minute for 1 minute ago", () => {
    const oneMinuteAgo = new Date(Date.now() - 1 * 60 * 1000);
    expect(formatTimeAgo(oneMinuteAgo)).toBe("1 minute ago");
  });

  it("returns minutes for short durations", () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    expect(formatTimeAgo(fiveMinutesAgo)).toBe("5 minutes ago");
  });

  it("returns singular hour for 1 hour ago", () => {
    const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000);
    expect(formatTimeAgo(oneHourAgo)).toBe("1 hour ago");
  });

  it("returns hours for longer durations", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    expect(formatTimeAgo(twoHoursAgo)).toBe("2 hours ago");
  });

  it("returns singular day for 1 day ago", () => {
    const oneDayAgo = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
    expect(formatTimeAgo(oneDayAgo)).toBe("1 day ago");
  });

  it("returns days for durations less than 30 days", () => {
    const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
    expect(formatTimeAgo(fifteenDaysAgo)).toBe("15 days ago");
  });

  it("returns singular month for 1 month ago", () => {
    const oneMonthAgo = new Date(Date.now() - 32 * 24 * 60 * 60 * 1000);
    expect(formatTimeAgo(oneMonthAgo)).toBe("1 month ago");
  });

  it("returns months for durations less than 12 months", () => {
    const sixMonthsAgo = new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000);
    expect(formatTimeAgo(sixMonthsAgo)).toBe("6 months ago");
  });

  it("returns singular year for 1 year ago", () => {
    const oneYearAgo = new Date(Date.now() - 13 * 30 * 24 * 60 * 60 * 1000);
    expect(formatTimeAgo(oneYearAgo)).toBe("1 year ago");
  });

  it("returns years for very long durations", () => {
    const threeYearsAgo = new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000);
    expect(formatTimeAgo(threeYearsAgo)).toBe("3 years ago");
  });
});

describe("formatTimeUntil", () => {
  it("returns less than a minute for near-future dates", () => {
    const soon = new Date(Date.now() + 20 * 1000);
    expect(formatTimeUntil(soon)).toBe("less than a minute");
  });

  it("returns less than a minute for past dates", () => {
    const past = new Date(Date.now() - 5000);
    expect(formatTimeUntil(past)).toBe("less than a minute");
  });

  it("returns singular minute for 1 minute from now", () => {
    const oneMinute = new Date(Date.now() + 1 * 60 * 1000);
    expect(formatTimeUntil(oneMinute)).toBe("1 minute");
  });

  it("returns minutes for short durations", () => {
    const fiveMinutes = new Date(Date.now() + 5 * 60 * 1000);
    expect(formatTimeUntil(fiveMinutes)).toBe("5 minutes");
  });

  it("returns 34 minutes for 34 minutes from now", () => {
    const thirtyFourMinutes = new Date(Date.now() + 34 * 60 * 1000);
    expect(formatTimeUntil(thirtyFourMinutes)).toBe("34 minutes");
  });

  it("returns singular hour for 1 hour from now", () => {
    const oneHour = new Date(Date.now() + 1 * 60 * 60 * 1000);
    expect(formatTimeUntil(oneHour)).toBe("1 hour");
  });

  it("returns hours for longer durations", () => {
    const twoHours = new Date(Date.now() + 2 * 60 * 60 * 1000);
    expect(formatTimeUntil(twoHours)).toBe("2 hours");
  });

  it("returns singular day for 1 day from now", () => {
    const oneDay = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000);
    expect(formatTimeUntil(oneDay)).toBe("1 day");
  });

  it("returns days for multi-day durations", () => {
    const threeDays = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    expect(formatTimeUntil(threeDays)).toBe("3 days");
  });
});
