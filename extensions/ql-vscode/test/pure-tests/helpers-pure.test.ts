import { fail } from 'assert';
import { expect } from 'chai';
import { asyncFilter } from '../../src/pure/helpers-pure';

describe('helpers-pure', () => {
  it('should filter asynchronously', async () => {
    expect(await asyncFilter([1, 2, 3], x => Promise.resolve(x > 2))).to.deep.eq([3]);
  });

  it('should throw on error when filtering', async () => {
    const rejects = (x: number) => x === 3
      ? Promise.reject(new Error('opps'))
      : Promise.resolve(true);

    try {
      await asyncFilter([1, 2, 3], rejects);
      fail('Should have thrown');
    } catch (e) {
      expect(e.message).to.eq('opps');
    }
  });
});
