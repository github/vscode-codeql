import * as vscode from 'vscode';
import { CodeQLCliServer } from './cli';

interface CodeQLTaskDefinition extends vscode.TaskDefinition {
  /**
   * The command to run.
   */
  command: string;

  /**
   * Additional command arguments.
   */
  commandArgs?: string[];
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
      return this.getTask(definition.command, definition.commandArgs ?? [], definition);
    }
    return undefined;
  }

  private getTasks(): vscode.Task[] {
    if (this.tasks !== undefined) {
      return this.tasks;
    }
    // Hard-code examples for now. Not sure if we can do this in a better way.
    const commands: string[] = ['resolve languages', 'version'];
    const commandArgs: string[][] = [[]];

    const tasks: vscode.Task[] | undefined = [];
    commands.forEach(command => {
      commandArgs.forEach(commandArgsGroup => {
        tasks.push(this.getTask(command, commandArgsGroup));
      });
    });
    this.tasks = tasks;
    return this.tasks;
  }

  private getTask(command: string, commandArgs: string[], definition?: CodeQLTaskDefinition): vscode.Task {
    if (definition === undefined) {
      definition = {
        type: CodeQLTaskProvider.CodeQLType,
        command,
        commandArgs
      };
    }
    return new vscode.Task(definition, vscode.TaskScope.Workspace, `${command} ${commandArgs.join(' ')}`,
      CodeQLTaskProvider.CodeQLType, new vscode.CustomExecution(async (): Promise<vscode.Pseudoterminal> => {
        return new CodeQLTaskTerminal(this.cliServer, command, commandArgs);
      }));
  }
}

class CodeQLTaskTerminal implements vscode.Pseudoterminal {
  private writeEmitter = new vscode.EventEmitter<string>();
  onDidWrite: vscode.Event<string> = this.writeEmitter.event;
  private closeEmitter = new vscode.EventEmitter<number>();
  onDidClose?: vscode.Event<number> = this.closeEmitter.event;

  private fileWatcher: vscode.FileSystemWatcher | undefined;

  constructor(private cliServer: CodeQLCliServer, private command: string, private commandArgs: string[]) {
  }

  async open(): Promise<void> {
    await this.runCli([this.command], this.commandArgs);
  }

  close(): void {
    // The terminal has been closed. Shutdown the build.
    if (this.fileWatcher) {
      this.fileWatcher.dispose();
    }
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
