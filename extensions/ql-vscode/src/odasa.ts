import * as path from 'path';
import * as child_process from 'child-process-promise';
import * as readline from 'readline';
import * as fs from 'fs-extra';

export interface QLTestHandler {
  onTestPassed(testId: string): void;
  onTestFailed(testId: string): void;
}

export type QLOptions = {
  distributionPath: string;
  licensePath?: string;
  output?(line: string): void;
  registerOnCancellationRequested?(listener: () => void): void;
  cwd?: string;
}

export interface QLTestOptions {
  acceptOutput?: boolean;
  optimize?: boolean;
  generateGraphs?: boolean;
  graphFormat?: string;
  splitNestedGraphs?: boolean;
  leaveTempFiles?: boolean;
  threads?: number;
  libraryPaths?: string[];
  tests: string[];
}

interface QLOutputMatcher {
  processStdOutLine?(line: string): void;
  processStdErrLine?(line: string): void;
}

const testFinishedRegex = /^\[\d+\/\d+\] (.*): (OK|FAILED)/;

export async function qlTest(taskOptions: QLOptions, testOptions: QLTestOptions,
  handler: QLTestHandler): Promise<void> {

  const args: string[] = [];
  if (testOptions.acceptOutput) {
    args.push('--accept-output');
  }
  if (testOptions.optimize) {
    args.push('--optimize');
  }
  if (testOptions.generateGraphs) {
    args.push('--generate-graphs');
  }
  if (testOptions.graphFormat) {
    args.push('--graph-format', testOptions.graphFormat);
  }
  if (testOptions.splitNestedGraphs) {
    args.push('--split-nested-graphs');
  }
  if (testOptions.leaveTempFiles) {
    args.push('--leave-temp-files');
  }
  if (testOptions.threads !== undefined) {
    args.push('--threads', testOptions.threads.toString());
  }
  if (testOptions.libraryPaths !== undefined) {
    for (const libraryPath of testOptions.libraryPaths) {
      args.push('--library', libraryPath);
    }
  }
  args.push(...testOptions.tests);

  await runOdasa('qltest', args, taskOptions, {
    processStdOutLine(line: string): void {
      const match = line.match(testFinishedRegex);
      if (match) {
        const testId = match[1];
        const status = match[2];
        switch (status) {
          case 'OK':
            handler.onTestPassed(testId);
            break;

          case 'FAILED':
            handler.onTestFailed(testId);
            break;
        }
      }
    }
  });
}

function getOdasaPath(options: QLOptions): string {
  const toolsDirectory = path.join(options.distributionPath, 'tools');
  if (process.platform === 'win32') {
    return path.join(toolsDirectory, 'odasa.exe');
  }
  else {
    return path.join(toolsDirectory, 'odasa');
  }
}

export async function isOdasaAvailable(options: QLOptions): Promise<boolean> {
  const odasaPath = getOdasaPath(options);
  return await fs.pathExists(odasaPath);
}

async function runOdasa(command: string, args: string[], options: QLOptions,
  matcher: QLOutputMatcher): Promise<void> {

  const odasaPath = getOdasaPath(options);
  const licensePath = options.licensePath;

  let env = process.env;
  if (licensePath !== undefined) {
    env.SEMMLE_LICENSE_DIR = licensePath;
  }

  const odasaArgs = [
    command,
    ...args
  ];
  const proc = child_process.spawn(odasaPath, odasaArgs, {
    cwd: options.cwd,
    env: env
  });

  const stdOutLines = readline.createInterface({
    input: proc.childProcess.stdout!,
    crlfDelay: Infinity
  });

  const stdErrLines = readline.createInterface({
    input: proc.childProcess.stderr!,
    crlfDelay: Infinity
  });

  stdOutLines.on('line', (line) => {
    if (options.output) {
      options.output(line);
    }
    if (matcher.processStdOutLine) {
      matcher.processStdOutLine(line);
    }
  });

  stdErrLines.on('line', (line) => {
    if (options.output) {
      options.output(line);
    }
    if (matcher.processStdErrLine) {
      matcher.processStdErrLine(line);
    }
  });

  if (options.registerOnCancellationRequested) {
    options.registerOnCancellationRequested(() => proc.childProcess.kill());
  }

  try {
    const result = await proc;
    if (result.code === 0) {
      return;
    }
    else {
      throw new Error(`'odasa ${command}' failed with exit code '${result.code}'.`);
    }
  }
  catch (e) {
    if (options.output) {
      options.output(e.message);
    }
    throw e;
  }
}
