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

    it('removes log lines', async () => {
      const input = ['first line', '[2020-02-15 09:10:15] Some logging information', 'last line'];
      const expected = ['first line', 'last line'];
      runTest(input, expected);
    });

    it('strips whitespace', async () => {
      const input = ['    first line', '    last line'];
      const expected = ['first line', 'last line'];
      runTest(input, expected);
    });

    it('removes one duplicate line', async () => {
      const input = ['first line', 'last line', 'last line'];
      const expected = ['first line', 'last line'];
      runTest(input, expected);
    });

    it('removes several duplicate lines', async () => {
      const input = ['first line', 'last line', 'last line', 'last line'];
      const expected = ['first line', 'last line'];
      runTest(input, expected);
    });

    it('shortens real example', async () => {
      const input = ['Interpreting query results failed: A fatal error occurred: Could not process query metadata.',
        'Error was: No query kind specified [NO_KIND_SPECIFIED]',
        '[2021-03-18 23:43:25] Exception caught at top level: Could not process query metadata.',
        '                      Error was: No query kind specified [NO_KIND_SPECIFIED]',
        '                      com.semmle.cli2.bqrs.InterpretCommand.executeSubcommand(InterpretCommand.java:126)',
        '                      com.semmle.cli2.picocli.SubcommandCommon.executeWithParent(SubcommandCommon.java:414)',
        '                      com.semmle.cli2.execute.CliServerCommand.lambda$executeSubcommand$0(CliServerCommand.java:67)',
        '                      com.semmle.cli2.picocli.SubcommandMaker.runMain(SubcommandMaker.java:201)',
        '                      com.semmle.cli2.execute.CliServerCommand.executeSubcommand(CliServerCommand.java:67)',
        '                      com.semmle.cli2.picocli.SubcommandCommon.call(SubcommandCommon.java:430)',
        '                      com.semmle.cli2.picocli.SubcommandMaker.runMain(SubcommandMaker.java:201)',
        '                      com.semmle.cli2.picocli.SubcommandMaker.runMain(SubcommandMaker.java:209)',
        '                      com.semmle.cli2.CodeQL.main(CodeQL.java:93)',
        'Will show raw results instead.'];
      const expected = ['Interpreting query results failed: A fatal error occurred: Could not process query metadata.',
        'Error was: No query kind specified [NO_KIND_SPECIFIED]',
        'Will show raw results instead.'];
      runTest(input, expected);
    });
  });
});
