import { expect } from 'chai';
import 'mocha';

import { humanizeDuration, humanizeUnit } from '../../src/pure/time';

describe('Time', () => {
  it('should return a humanized unit', () => {
    expect(humanizeUnit(undefined)).to.eq('Less than a minute');
    expect(humanizeUnit(0)).to.eq('Less than a minute');
    expect(humanizeUnit(-1)).to.eq('Less than a minute');
    expect(humanizeUnit(1000 * 60 - 1)).to.eq('Less than a minute');
    expect(humanizeUnit(1000 * 60)).to.eq('1 minute');
    expect(humanizeUnit(1000 * 60 * 2 - 1)).to.eq('1 minute');
    expect(humanizeUnit(1000 * 60 * 2)).to.eq('2 minutes');
    expect(humanizeUnit(1000 * 60 * 60)).to.eq('1 hour');
    expect(humanizeUnit(1000 * 60 * 60 * 2)).to.eq('2 hours');
    expect(humanizeUnit(1000 * 60 * 60 * 24)).to.eq('1 day');
    expect(humanizeUnit(1000 * 60 * 60 * 24 * 2)).to.eq('2 days');

    // assume every month has 30 days
    expect(humanizeUnit(1000 * 60 * 60 * 24 * 30)).to.eq('1 month');
    expect(humanizeUnit(1000 * 60 * 60 * 24 * 30 * 2)).to.eq('2 months');
    expect(humanizeUnit(1000 * 60 * 60 * 24 * 30 * 12)).to.eq('12 months');

    // assume every year has 365 days
    expect(humanizeUnit(1000 * 60 * 60 * 24 * 365)).to.eq('1 year');
    expect(humanizeUnit(1000 * 60 * 60 * 24 * 365 * 2)).to.eq('2 years');
  });

  it('should return a humanized duration positive', () => {
    expect(humanizeDuration(undefined)).to.eq('');
    expect(humanizeDuration(0)).to.eq('this minute');
    expect(humanizeDuration(1)).to.eq('this minute');
    expect(humanizeDuration(1000 * 60 - 1)).to.eq('this minute');
    expect(humanizeDuration(1000 * 60)).to.eq('in 1 minute');
    expect(humanizeDuration(1000 * 60 * 2 - 1)).to.eq('in 1 minute');
    expect(humanizeDuration(1000 * 60 * 2)).to.eq('in 2 minutes');
    expect(humanizeDuration(1000 * 60 * 60)).to.eq('in 1 hour');
    expect(humanizeDuration(1000 * 60 * 60 * 2)).to.eq('in 2 hours');
    expect(humanizeDuration(1000 * 60 * 60 * 24)).to.eq('tomorrow');
    expect(humanizeDuration(1000 * 60 * 60 * 24 * 2)).to.eq('in 2 days');

    // assume every month has 30 days
    expect(humanizeDuration(1000 * 60 * 60 * 24 * 30)).to.eq('next month');
    expect(humanizeDuration(1000 * 60 * 60 * 24 * 30 * 2)).to.eq('in 2 months');
    expect(humanizeDuration(1000 * 60 * 60 * 24 * 30 * 12)).to.eq('in 12 months');

    // assume every year has 365 days
    expect(humanizeDuration(1000 * 60 * 60 * 24 * 365)).to.eq('next year');
    expect(humanizeDuration(1000 * 60 * 60 * 24 * 365 * 2)).to.eq('in 2 years');
  });

  it('should return a humanized duration negative', () => {
    expect(humanizeDuration(-1)).to.eq('1 minute ago');
    expect(humanizeDuration(-1000 * 60)).to.eq('1 minute ago');
    expect(humanizeDuration(-1000 * 60 - 1)).to.eq('2 minutes ago');
    expect(humanizeDuration(-1000 * 60 * 2)).to.eq('2 minutes ago');
    expect(humanizeDuration(-1000 * 60 * 2 - 1)).to.eq('3 minutes ago');
    expect(humanizeDuration(-1000 * 60 * 60)).to.eq('1 hour ago');
    expect(humanizeDuration(-1000 * 60 * 60 * 2)).to.eq('2 hours ago');
    expect(humanizeDuration(-1000 * 60 * 60 * 24)).to.eq('yesterday');
    expect(humanizeDuration(-1000 * 60 * 60 * 24 * 2)).to.eq('2 days ago');

    // assume every month has 30 days
    expect(humanizeDuration(-1000 * 60 * 60 * 24 * 30)).to.eq('last month');
    expect(humanizeDuration(-1000 * 60 * 60 * 24 * 30 * 2)).to.eq('2 months ago');
    expect(humanizeDuration(-1000 * 60 * 60 * 24 * 30 * 12)).to.eq('12 months ago');

    // assume every year has 365 days
    expect(humanizeDuration(-1000 * 60 * 60 * 24 * 365)).to.eq('last year');
    expect(humanizeDuration(-1000 * 60 * 60 * 24 * 365 * 2)).to.eq('2 years ago');
  });
});
