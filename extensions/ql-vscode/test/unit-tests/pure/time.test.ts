import { humanizeRelativeTime, humanizeUnit } from "../../../src/common/time";

describe("Time", () => {
  it("should return a humanized unit", () => {
    expect(humanizeUnit(undefined)).toBe("Less than a second");
    expect(humanizeUnit(0)).toBe("Less than a second");
    expect(humanizeUnit(-1)).toBe("Less than a second");
    expect(humanizeUnit(1000 - 1)).toBe("Less than a second");
    expect(humanizeUnit(1000)).toBe("1 second");
    expect(humanizeUnit(1000 * 2)).toBe("2 seconds");
    expect(humanizeUnit(1000 * 60 - 1)).toBe("59 seconds");
    expect(humanizeUnit(1000 * 60)).toBe("1 minute");
    expect(humanizeUnit(1000 * 60 * 2 - 1)).toBe("1 minute");
    expect(humanizeUnit(1000 * 60 * 2)).toBe("2 minutes");
    expect(humanizeUnit(1000 * 60 * 60)).toBe("1 hour");
    expect(humanizeUnit(1000 * 60 * 60 * 2)).toBe("2 hours");
    expect(humanizeUnit(1000 * 60 * 60 * 24)).toBe("1 day");
    expect(humanizeUnit(1000 * 60 * 60 * 24 * 2)).toBe("2 days");

    // assume every month has 30 days
    expect(humanizeUnit(1000 * 60 * 60 * 24 * 30)).toBe("1 month");
    expect(humanizeUnit(1000 * 60 * 60 * 24 * 30 * 2)).toBe("2 months");
    expect(humanizeUnit(1000 * 60 * 60 * 24 * 30 * 12)).toBe("12 months");

    // assume every year has 365 days
    expect(humanizeUnit(1000 * 60 * 60 * 24 * 365)).toBe("1 year");
    expect(humanizeUnit(1000 * 60 * 60 * 24 * 365 * 2)).toBe("2 years");
  });

  it("should return a humanized duration positive", () => {
    expect(humanizeRelativeTime(undefined)).toBe("");
    expect(humanizeRelativeTime(0)).toBe("this minute");
    expect(humanizeRelativeTime(1)).toBe("this minute");
    expect(humanizeRelativeTime(1000 * 60 - 1)).toBe("this minute");
    expect(humanizeRelativeTime(1000 * 60)).toBe("in 1 minute");
    expect(humanizeRelativeTime(1000 * 60 * 2 - 1)).toBe("in 1 minute");
    expect(humanizeRelativeTime(1000 * 60 * 2)).toBe("in 2 minutes");
    expect(humanizeRelativeTime(1000 * 60 * 60)).toBe("in 1 hour");
    expect(humanizeRelativeTime(1000 * 60 * 60 * 2)).toBe("in 2 hours");
    expect(humanizeRelativeTime(1000 * 60 * 60 * 24)).toBe("tomorrow");
    expect(humanizeRelativeTime(1000 * 60 * 60 * 24 * 2)).toBe("in 2 days");

    // assume every month has 30 days
    expect(humanizeRelativeTime(1000 * 60 * 60 * 24 * 30)).toBe("next month");
    expect(humanizeRelativeTime(1000 * 60 * 60 * 24 * 30 * 2)).toBe(
      "in 2 months",
    );
    expect(humanizeRelativeTime(1000 * 60 * 60 * 24 * 30 * 12)).toBe(
      "in 12 months",
    );

    // assume every year has 365 days
    expect(humanizeRelativeTime(1000 * 60 * 60 * 24 * 365)).toBe("next year");
    expect(humanizeRelativeTime(1000 * 60 * 60 * 24 * 365 * 2)).toBe(
      "in 2 years",
    );
  });

  it("should return a humanized duration negative", () => {
    expect(humanizeRelativeTime(-1)).toBe("this minute");
    expect(humanizeRelativeTime(-1000 * 60)).toBe("1 minute ago");
    expect(humanizeRelativeTime(-1000 * 60 - 1)).toBe("1 minute ago");
    expect(humanizeRelativeTime(-1000 * 60 * 2)).toBe("2 minutes ago");
    expect(humanizeRelativeTime(-1000 * 60 * 2 - 1)).toBe("2 minutes ago");
    expect(humanizeRelativeTime(-1000 * 60 * 3)).toBe("3 minutes ago");
    expect(humanizeRelativeTime(-1000 * 60 * 60)).toBe("1 hour ago");
    expect(humanizeRelativeTime(-1000 * 60 * 60 - 1)).toBe("1 hour ago");
    expect(humanizeRelativeTime(-1000 * 60 * 60 * 2)).toBe("2 hours ago");
    expect(humanizeRelativeTime(-1000 * 60 * 60 * 24)).toBe("yesterday");
    expect(humanizeRelativeTime(-1000 * 60 * 60 * 24 * 2)).toBe("2 days ago");

    // assume every month has 30 days
    expect(humanizeRelativeTime(-1000 * 60 * 60 * 24 * 30)).toBe("last month");
    expect(humanizeRelativeTime(-1000 * 60 * 60 * 24 * 30 * 2)).toBe(
      "2 months ago",
    );
    expect(humanizeRelativeTime(-1000 * 60 * 60 * 24 * 30 * 12)).toBe(
      "12 months ago",
    );

    // assume every year has 365 days
    expect(humanizeRelativeTime(-1000 * 60 * 60 * 24 * 365)).toBe("last year");
    expect(humanizeRelativeTime(-1000 * 60 * 60 * 24 * 365 * 2)).toBe(
      "2 years ago",
    );
  });
});
