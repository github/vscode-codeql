import { expect } from 'chai';
import 'mocha';

import { formatDate } from '../../src/pure/date';

describe('Date', () => {
  it('should return a formatted date', () => {
    expect(formatDate(new Date(1663326904000))).to.eq('Sep 16, 1:15 PM');
    expect(formatDate(new Date(1631783704000))).to.eq('Sep 16, 2021, 11:15 AM');
  });
});
