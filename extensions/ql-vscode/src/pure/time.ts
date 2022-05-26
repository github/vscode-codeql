/*
 * Contains an assortment of helper functions for working with time, dates, and durations.
 */


const durationFormatter = new Intl.RelativeTimeFormat('en', {
  numeric: 'auto',
});

// All these are approximate, specifically months and years
const MINUTE_IN_MILLIS = 1000 * 60;
const HOUR_IN_MILLIS = 60 * MINUTE_IN_MILLIS;
const DAY_IN_MILLIS = 24 * HOUR_IN_MILLIS;
const MONTH_IN_MILLIS = 30 * DAY_IN_MILLIS;
const YEAR_IN_MILLIS = 365 * DAY_IN_MILLIS;

export function humanizeDuration(diffInMs?: number) {
  if (diffInMs === undefined) {
    return '';
  }

  if (Math.abs(diffInMs) < HOUR_IN_MILLIS) {
    return durationFormatter.format(Math.floor(diffInMs / MINUTE_IN_MILLIS), 'minute');
  } else if (Math.abs(diffInMs) < DAY_IN_MILLIS) {
    return durationFormatter.format(Math.floor(diffInMs / HOUR_IN_MILLIS), 'hour');
  } else if (Math.abs(diffInMs) < MONTH_IN_MILLIS) {
    return durationFormatter.format(Math.floor(diffInMs / DAY_IN_MILLIS), 'day');
  } else if (Math.abs(diffInMs) < YEAR_IN_MILLIS) {
    return durationFormatter.format(Math.floor(diffInMs / MONTH_IN_MILLIS), 'month');
  } else {
    return durationFormatter.format(Math.floor(diffInMs / YEAR_IN_MILLIS), 'year');
  }
}

function createFormatter(unit: string) {
  return Intl.NumberFormat('en-US', {
    style: 'unit',
    unit,
    unitDisplay: 'long'
  });
}

export function humanizeUnit(diffInMs?: number): string {
  // assume a blank or empty string is a zero
  // assume anything less than 0 is a zero
  if (!diffInMs || diffInMs < MINUTE_IN_MILLIS) {
    return 'Less than a minute';
  }
  let unit: string;
  let unitDiff: number;
  if (diffInMs < HOUR_IN_MILLIS) {
    unit = 'minute';
    unitDiff = Math.floor(diffInMs / MINUTE_IN_MILLIS);
  } else if (diffInMs < DAY_IN_MILLIS) {
    unit = 'hour';
    unitDiff = Math.floor(diffInMs / HOUR_IN_MILLIS);
  } else if (diffInMs < MONTH_IN_MILLIS) {
    unit = 'day';
    unitDiff = Math.floor(diffInMs / DAY_IN_MILLIS);
  } else if (diffInMs < YEAR_IN_MILLIS) {
    unit = 'month';
    unitDiff = Math.floor(diffInMs / MONTH_IN_MILLIS);
  } else {
    unit = 'year';
    unitDiff = Math.floor(diffInMs / YEAR_IN_MILLIS);
  }

  return createFormatter(unit).format(unitDiff);
}
