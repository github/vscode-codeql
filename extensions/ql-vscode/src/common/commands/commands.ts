import { CancellationToken, commands, ProgressOptions } from "vscode";
import {
  commandRunner,
  commandRunnerWithProgress,
  ProgressCallback,
} from "../../commandRunner";
import { VariantAnalysis } from "../../remote-queries/shared/variant-analysis";
import { DisposableObject } from "../../pure/disposable-object";
import { OutputChannelLogger } from "../logging";

type CommandFunction = (...args: any[]) => Promise<unknown>;
type ProgressCommandFunction = (
  progress: ProgressCallback,
  token: CancellationToken,
  ...args: any[]
) => Promise<unknown>;

type CommandDefinition =
  | CommandFunction
  | {
      execute: ProgressCommandFunction;
      progress: Partial<ProgressOptions>;
      outputLogger?: OutputChannelLogger;
    };

type CommandFunctionCallSignature<T> = T extends (
  progress: ProgressCallback,
  token: CancellationToken,
  ...args: infer U
) => Promise<infer R>
  ? (...args: U) => Promise<R>
  : T extends (...args: any[]) => Promise<any>
  ? T
  : never;

type CommandDefinitionFunction<T extends CommandDefinition> =
  T extends CommandFunction
    ? T
    : T extends { execute: infer U }
    ? CommandFunctionCallSignature<U>
    : never;

type CommandParameters<T extends CommandDefinition> = Parameters<
  CommandDefinitionFunction<T>
>;
type CommandReturnType<T extends CommandDefinition> = Awaited<
  ReturnType<CommandDefinitionFunction<T>>
>;

const variantAnalysisCommands = {
  "codeQL.openVariantAnalysisView": async (variantAnalysisId: number) => {
    console.log(variantAnalysisId);
  },
  "codeQL.monitorVariantAnalysis": async (variantAnalysis: VariantAnalysis) => {
    console.log(variantAnalysis);
  },
  "codeQL.runVariantAnalysis": {
    execute: async (
      _progress: ProgressCallback,
      _token: CancellationToken,
      variantAnalysisId: number,
    ) => {
      console.log(variantAnalysisId);
    },
    progress: {
      title: "Running variant analysis",
    },
  },
};

const otherCommands = {
  "codeql.getRandomNumber": async () => {
    return Math.random();
  },
};

const allCommands = {
  ...variantAnalysisCommands,
  ...otherCommands,
};

type VSCodeCommands = {
  setContext: (key: `codeQL.${string}`, value: unknown) => Promise<void>;
};

export type AllCommands = VSCodeCommands & typeof allCommands;

interface CommandExecutor<
  Commands extends Record<string, CommandDefinition>,
  CommandName extends keyof Commands & string = keyof Commands & string,
> {
  executeCommand<T extends CommandName>(
    command: T,
    ...args: CommandParameters<Commands[T]>
  ): Thenable<CommandReturnType<Commands[T]>>;
}

class VSCodeCommandManager<
    Commands extends Record<string, CommandDefinition>,
    CommandName extends keyof Commands & string = keyof Commands & string,
  >
  extends DisposableObject
  implements CommandExecutor<Commands, CommandName>
{
  constructor(commands: Partial<Commands>) {
    super();

    for (const [command, definitionAny] of Object.entries(commands)) {
      const definition = definitionAny as CommandDefinition;

      if (typeof definition === "function") {
        this.push(commandRunner(command, definition));
      } else if (definition.progress) {
        this.push(
          commandRunnerWithProgress(
            command,
            definition.execute,
            definition.progress ?? {},
            definition.outputLogger,
          ),
        );
      } else {
        throw new Error(`Unexpected command definition: ${command}`);
      }
    }
  }

  executeCommand<T extends CommandName>(
    command: T,
    ...args: CommandParameters<Commands[T]>
  ): Thenable<CommandReturnType<Commands[T]>> {
    return commands.executeCommand(command, ...args);
  }
}

async function testRegistrationAndExecution() {
  const commandManager = new VSCodeCommandManager<AllCommands>(allCommands);

  await commandManager.executeCommand("setContext", "codeQL.test", "value");

  await commandManager.executeCommand("codeQL.runVariantAnalysis", 5);

  const randomNumber = await commandManager.executeCommand(
    "codeql.getRandomNumber",
  );

  console.log(randomNumber);
}
