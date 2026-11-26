import type { TextEditor } from "vscode";
import { Uri, window } from "vscode";

import type { CodeQLCliServer } from "../../../../src/codeql-cli/cli";
import { getQueryEditorCommands } from "../../../../src/language-support";
import type { QueryRunner } from "../../../../src/query-server";
import { createMockCommandManager } from "../../../__mocks__/commandsMock";
import { mockedObject } from "../../utils/mocking.helpers";

describe("open referenced file command", () => {
  let showTextDocumentSpy: jest.SpiedFunction<typeof window.showTextDocument>;

  beforeEach(() => {
    showTextDocumentSpy = jest
      .spyOn(window, "showTextDocument")
      .mockResolvedValue(mockedObject<TextEditor>({}));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("resolves a qlref and opens the referenced query", async () => {
    const selectedQuery = Uri.file("/tmp/reference.qlref");
    const resolvedPath = "/tmp/referenced-query.ql";
    const resolveQlref = jest.fn().mockResolvedValue({ resolvedPath });
    const cliServer = mockedObject<CodeQLCliServer>({ resolveQlref });
    const queryRunner = mockedObject<QueryRunner>({});

    const commands = getQueryEditorCommands({
      commandManager: createMockCommandManager(),
      queryRunner,
      cliServer,
      qhelpTmpDir: "/tmp/qhelp",
    });

    await commands["codeQL.openReferencedFile"](selectedQuery);

    expect(resolveQlref).toHaveBeenCalledTimes(1);
    expect(resolveQlref).toHaveBeenCalledWith(selectedQuery.fsPath);
    expect(showTextDocumentSpy).toHaveBeenCalledTimes(1);
    expect(showTextDocumentSpy).toHaveBeenCalledWith(Uri.file(resolvedPath), {
      preview: false,
    });
  });
});
