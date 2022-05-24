import * as React from 'react';
import { CalendarIcon } from '@primer/octicons-react';
import styled from 'styled-components';

const Calendar = styled.span`
  flex-grow: 0;
  text-align: right;
  margin-right: 0;
`;

const Duration = styled.span`
  text-align: left;
  width: 8em;
  margin-left: 0.5em;
`;

type Props = { lastUpdated?: number };

const LastUpdated = ({ lastUpdated }: Props) => (
  Number.isFinite(lastUpdated) ? (
    <>
      <Calendar>
        <CalendarIcon size={16} />
      </Calendar>
      <Duration>
        {humanizeDuration(lastUpdated)}
      </Duration>
    </>
  ) : (
    <></>
  )
);

export default LastUpdated;

const formatter = new Intl.RelativeTimeFormat('en', {
  numeric: 'auto'
});

// All these are approximate, specifically months and years
const MINUTES_IN_MILLIS = 1000 * 60;
const HOURS_IN_MILLIS = 60 * MINUTES_IN_MILLIS;
const DAYS_IN_MILLIS = 24 * HOURS_IN_MILLIS;
const MONTHS_IN_MILLIS = 30 * DAYS_IN_MILLIS;
const YEARS_IN_MILLIS = 365 * DAYS_IN_MILLIS;

function humanizeDuration(from?: number) {
  if (!from) {
    return '';
  }
  const diff = Date.now() - from;
  if (diff < HOURS_IN_MILLIS) {
    return formatter.format(- Math.floor(diff / MINUTES_IN_MILLIS), 'minute');
  } else if (diff < DAYS_IN_MILLIS) {
    return formatter.format(- Math.floor(diff / HOURS_IN_MILLIS), 'hour');
  } else if (diff < MONTHS_IN_MILLIS) {
    return formatter.format(- Math.floor(diff / DAYS_IN_MILLIS), 'day');
  } else if (diff < YEARS_IN_MILLIS) {
    return formatter.format(- Math.floor(diff / MONTHS_IN_MILLIS), 'month');
  } else {
    return formatter.format(- Math.floor(diff / YEARS_IN_MILLIS), 'year');
  }
}
