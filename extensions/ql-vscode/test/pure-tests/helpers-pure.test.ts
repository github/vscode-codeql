import { fail } from 'assert';
import { expect } from 'chai';
import { asyncFilter, shortenErrorMessage } from '../../src/pure/helpers-pure';

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

  describe('error message shortener', () => {
    const WINDOWS_LINE_END = '\r\n';
    const LINUX_LINE_END = '\n';

    function runTest(input: string[], expected: string[]) {
      expect(shortenErrorMessage(input.join(WINDOWS_LINE_END)).split(WINDOWS_LINE_END)).eql(expected);
      expect(shortenErrorMessage(input.join(LINUX_LINE_END)).split(LINUX_LINE_END)).eql(expected);
    }

    it('removes stack traces', async () => {
      const input = ['first line', '    com.a.java.class.command(Class.java:65)', 'last line'];
      const expected = ['first line', 'last line'];
      runTest(input, expected);
    });

    it('removes log lines lines', async () => {
      const input = ['first line', '[2020-02-15 09:10:15] Some logging information', 'last line'];
      const expected = ['first line', 'last line'];
      runTest(input, expected);
    });

    it('strips whitespace', async () => {
      const input = ['    first line', '    last line'];
      const expected = ['first line', 'last line'];
      runTest(input, expected);
    });

    it('removes duplicate lines', async () => {
      const input = ['first line', 'last line', 'last line'];
      const expected = ['first line', 'last line'];
      runTest(input, expected);
    });
  });
});
