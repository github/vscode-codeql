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
const MINUTE_IN_MILLIS = 1000 * 60;
const HOUR_IN_MILLIS = 60 * MINUTE_IN_MILLIS;
const DAY_IN_MILLIS = 24 * HOUR_IN_MILLIS;
const MONTH_IN_MILLIS = 30 * DAY_IN_MILLIS;
const YEAR_IN_MILLIS = 365 * DAY_IN_MILLIS;

function humanizeDuration(diff?: number) {
  if (!diff) {
    return '';
  }
  if (diff < HOUR_IN_MILLIS) {
    return formatter.format(- Math.floor(diff / MINUTE_IN_MILLIS), 'minute');
  } else if (diff < DAY_IN_MILLIS) {
    return formatter.format(- Math.floor(diff / HOUR_IN_MILLIS), 'hour');
  } else if (diff < MONTH_IN_MILLIS) {
    return formatter.format(- Math.floor(diff / DAY_IN_MILLIS), 'day');
  } else if (diff < YEAR_IN_MILLIS) {
    return formatter.format(- Math.floor(diff / MONTH_IN_MILLIS), 'month');
  } else {
    return formatter.format(- Math.floor(diff / YEAR_IN_MILLIS), 'year');
  }
}
