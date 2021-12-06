import * as vscode from 'vscode';
import { CodeQLCliServer } from './cli';
import * as path from 'path';
import * as fs from 'fs-extra';

import { getOnDiskWorkspaceFolders } from './helpers';
import { DisposableObject } from './pure/disposable-object';
import { UserCancellationException } from './commandRunner';

interface CodeQLTaskDefinition extends vscode.TaskDefinition {
  /**
   * The command to run.
   */
  command: string;

  /**
   * Additional command arguments.
   */
  commandArgs: string[];

  /**
   * User-specified properties for the task.
   */
  prompts: string[];
}

export class CodeQLTaskProvider implements vscode.TaskProvider {
  static CodeQLType = 'codeql';
  private tasks: vscode.Task[] | undefined;

  constructor(private cliServer: CodeQLCliServer) { }

  public provideTasks(): vscode.Task[] {
    return this.getTasks();
  }

  public resolveTask(_task: vscode.Task): vscode.Task | undefined {
    const command: string = _task.definition.command;
    if (command) {
      const definition: CodeQLTaskDefinition = <any>_task.definition;
      return this.getTask(definition);
    }
    return undefined;
  }

  private getTasks(): vscode.Task[] {
    if (this.tasks !== undefined) {
      return this.tasks;
    }
    const cliCommands: CodeQLTaskDefinition[] = [
      {
        command: 'version',  // TODO: Delete this, just a test command.
        commandArgs: [],
        prompts: [],
        type: CodeQLTaskProvider.CodeQLType,
      },
      {
        command: 'resolve qlpacks',
        commandArgs: ['--additional-packs', getOnDiskWorkspaceFolders().join(path.delimiter)],
        prompts: [],
        type: CodeQLTaskProvider.CodeQLType,
      },
      {
        command: 'pack install',
        commandArgs: [],       // TODO: Specify which qlpack to install dependencies for. Resolve the commandArgs to all qlpack.ymls in the workspace and add those as --dir args.
        prompts: [],
        type: CodeQLTaskProvider.CodeQLType,
      },
      {
        command: 'pack download',
        commandArgs: [],
        prompts: ['Enter the <package-scope/name[@version]> of the pack to download:'],
        type: CodeQLTaskProvider.CodeQLType,
      },  // Needs a PAT for private packs (from octokit?)
      // 'database create'   // Needs additional args.
    ];

    const tasks: vscode.Task[] | undefined = [];
    cliCommands.forEach(cliCommand => {
      tasks.push(this.getTask(cliCommand));
    });
    this.tasks = tasks;
    return this.tasks;
  }

  private getTask(cliCommand: CodeQLTaskDefinition): vscode.Task {
    return new vscode.Task(cliCommand, vscode.TaskScope.Workspace, `${cliCommand.command} ${cliCommand.commandArgs.join(' ')}`,
      CodeQLTaskProvider.CodeQLType, new vscode.CustomExecution(async (): Promise<vscode.Pseudoterminal> => {
        return new CodeQLTaskTerminal(this.cliServer, cliCommand.command, cliCommand.commandArgs, cliCommand.prompts);
      }));
  }
}

class CodeQLTaskTerminal extends DisposableObject implements vscode.Pseudoterminal {
  private writeEmitter = new vscode.EventEmitter<string>();
  onDidWrite: vscode.Event<string> = this.writeEmitter.event;
  private closeEmitter = new vscode.EventEmitter<number>();
  onDidClose?: vscode.Event<number> = this.closeEmitter.event;

  // TODO: Open the terminal (i.e. run the task) in an appropriate folder (e.g. the enclosing folder of the currently active editor).
  // Currently, it is run from the first workspace folder (codeql-custom-queries-cpp in the starter workspace).
  constructor(private cliServer: CodeQLCliServer, private command: string, private commandArgs: string[], private prompts: string[]) {
    super();
  }

  async open(): Promise<void> {
    const promptedArgs: string[] = [];
    for (const prompt of this.prompts) {
      const result = await vscode.window.showInputBox({ prompt, ignoreFocusOut: true });
      if (result === undefined) {
        throw new UserCancellationException('No inputs provided.');
      }
      promptedArgs.push(result);
    }
    await this.runCli([this.command], this.commandArgs.concat(promptedArgs));
  }

  close(): void {
    this.dispose();
  }

  private async runCli(command: string[], commandArgs: string[]): Promise<void> {
    this.writeEmitter.fire('Running CodeQL task\r\n');
    try {
      const output = await this.cliServer.runCodeQlCliCommand(command, commandArgs, '');
      this.writeEmitter.fire(output);
    } catch (e) {
      this.writeEmitter.fire(`Error running CodeQL task: ${e}\r\n`);
    }
    this.closeEmitter.fire(0);
  }
}

/**
 * Lists all workspace folders that contain a qlpack.yml file.
 */
function getWorkspacePacks(): string[] {
  const packs: string[] = [];
  const workspaceFolders = getOnDiskWorkspaceFolders();
  for (const folder of workspaceFolders) {
    const qlpackYml = path.join(folder, 'qlpack.yml');
    if (fs.pathExists(qlpackYml)) {
      packs.push(folder);
    }
  }
  return packs;
}
