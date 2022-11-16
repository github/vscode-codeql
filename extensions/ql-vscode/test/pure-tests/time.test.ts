import { expect } from "chai";
import "mocha";

import { humanizeRelativeTime, humanizeUnit } from "../../src/pure/time";

describe("Time", () => {
  it("should return a humanized unit", () => {
    expect(humanizeUnit(undefined)).to.eq("Less than a second");
    expect(humanizeUnit(0)).to.eq("Less than a second");
    expect(humanizeUnit(-1)).to.eq("Less than a second");
    expect(humanizeUnit(1000 - 1)).to.eq("Less than a second");
    expect(humanizeUnit(1000)).to.eq("1 second");
    expect(humanizeUnit(1000 * 2)).to.eq("2 seconds");
    expect(humanizeUnit(1000 * 60 - 1)).to.eq("59 seconds");
    expect(humanizeUnit(1000 * 60)).to.eq("1 minute");
    expect(humanizeUnit(1000 * 60 * 2 - 1)).to.eq("1 minute");
    expect(humanizeUnit(1000 * 60 * 2)).to.eq("2 minutes");
    expect(humanizeUnit(1000 * 60 * 60)).to.eq("1 hour");
    expect(humanizeUnit(1000 * 60 * 60 * 2)).to.eq("2 hours");
    expect(humanizeUnit(1000 * 60 * 60 * 24)).to.eq("1 day");
    expect(humanizeUnit(1000 * 60 * 60 * 24 * 2)).to.eq("2 days");

    // assume every month has 30 days
    expect(humanizeUnit(1000 * 60 * 60 * 24 * 30)).to.eq("1 month");
    expect(humanizeUnit(1000 * 60 * 60 * 24 * 30 * 2)).to.eq("2 months");
    expect(humanizeUnit(1000 * 60 * 60 * 24 * 30 * 12)).to.eq("12 months");

    // assume every year has 365 days
    expect(humanizeUnit(1000 * 60 * 60 * 24 * 365)).to.eq("1 year");
    expect(humanizeUnit(1000 * 60 * 60 * 24 * 365 * 2)).to.eq("2 years");
  });

  it("should return a humanized duration positive", () => {
    expect(humanizeRelativeTime(undefined)).to.eq("");
    expect(humanizeRelativeTime(0)).to.eq("this minute");
    expect(humanizeRelativeTime(1)).to.eq("this minute");
    expect(humanizeRelativeTime(1000 * 60 - 1)).to.eq("this minute");
    expect(humanizeRelativeTime(1000 * 60)).to.eq("in 1 minute");
    expect(humanizeRelativeTime(1000 * 60 * 2 - 1)).to.eq("in 1 minute");
    expect(humanizeRelativeTime(1000 * 60 * 2)).to.eq("in 2 minutes");
    expect(humanizeRelativeTime(1000 * 60 * 60)).to.eq("in 1 hour");
    expect(humanizeRelativeTime(1000 * 60 * 60 * 2)).to.eq("in 2 hours");
    expect(humanizeRelativeTime(1000 * 60 * 60 * 24)).to.eq("tomorrow");
    expect(humanizeRelativeTime(1000 * 60 * 60 * 24 * 2)).to.eq("in 2 days");

    // assume every month has 30 days
    expect(humanizeRelativeTime(1000 * 60 * 60 * 24 * 30)).to.eq("next month");
    expect(humanizeRelativeTime(1000 * 60 * 60 * 24 * 30 * 2)).to.eq(
      "in 2 months",
    );
    expect(humanizeRelativeTime(1000 * 60 * 60 * 24 * 30 * 12)).to.eq(
      "in 12 months",
    );

    // assume every year has 365 days
    expect(humanizeRelativeTime(1000 * 60 * 60 * 24 * 365)).to.eq("next year");
    expect(humanizeRelativeTime(1000 * 60 * 60 * 24 * 365 * 2)).to.eq(
      "in 2 years",
    );
  });

  it("should return a humanized duration negative", () => {
    expect(humanizeRelativeTime(-1)).to.eq("this minute");
    expect(humanizeRelativeTime(-1000 * 60)).to.eq("1 minute ago");
    expect(humanizeRelativeTime(-1000 * 60 - 1)).to.eq("1 minute ago");
    expect(humanizeRelativeTime(-1000 * 60 * 2)).to.eq("2 minutes ago");
    expect(humanizeRelativeTime(-1000 * 60 * 2 - 1)).to.eq("2 minutes ago");
    expect(humanizeRelativeTime(-1000 * 60 * 3)).to.eq("3 minutes ago");
    expect(humanizeRelativeTime(-1000 * 60 * 60)).to.eq("1 hour ago");
    expect(humanizeRelativeTime(-1000 * 60 * 60 - 1)).to.eq("1 hour ago");
    expect(humanizeRelativeTime(-1000 * 60 * 60 * 2)).to.eq("2 hours ago");
    expect(humanizeRelativeTime(-1000 * 60 * 60 * 24)).to.eq("yesterday");
    expect(humanizeRelativeTime(-1000 * 60 * 60 * 24 * 2)).to.eq("2 days ago");

    // assume every month has 30 days
    expect(humanizeRelativeTime(-1000 * 60 * 60 * 24 * 30)).to.eq("last month");
    expect(humanizeRelativeTime(-1000 * 60 * 60 * 24 * 30 * 2)).to.eq(
      "2 months ago",
    );
    expect(humanizeRelativeTime(-1000 * 60 * 60 * 24 * 30 * 12)).to.eq(
      "12 months ago",
    );

    // assume every year has 365 days
    expect(humanizeRelativeTime(-1000 * 60 * 60 * 24 * 365)).to.eq("last year");
    expect(humanizeRelativeTime(-1000 * 60 * 60 * 24 * 365 * 2)).to.eq(
      "2 years ago",
    );
  });
});
