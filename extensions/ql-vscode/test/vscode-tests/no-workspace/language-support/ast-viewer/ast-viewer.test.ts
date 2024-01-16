import { readFile } from "fs-extra";
import { load } from "js-yaml";

import type { AstItem } from "../../../../../src/language-support";
import { AstViewer } from "../../../../../src/language-support";
import { commands, Range, Uri } from "vscode";
import { testDisposeHandler } from "../../../test-dispose-handler";
import { mockDatabaseItem } from "../../../utils/mocking.helpers";

describe("AstViewer", () => {
  let astRoots: AstItem[];
  let viewer: AstViewer | undefined;
  beforeEach(async () => {
    // the ast is stored in yaml because there are back pointers
    // making a json representation impossible.
    // The complication here is that yaml files are not copied into the 'out' directory by tsc.
    astRoots = await buildAst();

    jest.spyOn(commands, "registerCommand").mockImplementation(() => ({
      dispose: jest.fn(),
    }));
    jest
      .spyOn(commands, "executeCommand")
      .mockImplementation(() => Promise.resolve());
  });

  afterEach(() => {
    if (viewer) {
      viewer.dispose(testDisposeHandler);
      viewer = undefined;
    }
  });

  it("should update the viewer roots", () => {
    const item = mockDatabaseItem();
    viewer = new AstViewer();
    viewer.updateRoots(astRoots, item, Uri.file("def/abc"));

    expect((viewer as any).treeDataProvider.roots).toBe(astRoots);
    expect((viewer as any).treeDataProvider.db).toBe(item);
    expect((viewer as any).treeView.message).toBe("AST for abc");
  });

  it("should update the tree selection based on a change in the editor selection", () => {
    // Should select the namespace
    doSelectionTest(astRoots[0], astRoots[0].fileLocation?.range);
  });

  it("should select an AssignExpr", () => {
    // this one is interesting because it spans a couple of other nodes
    const expr = findNodeById(300, astRoots);
    expect(expr.label).toBe("[AssignExpr] ... = ...");
    doSelectionTest(expr, expr.fileLocation?.range);
  });

  it("should select nothing because of no overlap in range", () => {
    doSelectionTest(undefined, new Range(2, 3, 4, 5));
  });

  it("should select nothing because of different file", () => {
    doSelectionTest(
      undefined,
      astRoots[0].fileLocation?.range,
      Uri.file("def"),
    );
  });

  const defaultUri = Uri.file("def/abc");

  function doSelectionTest(
    expectedSelection: any,
    selectionRange: Range | undefined,
    fileUri = defaultUri,
  ) {
    const item = mockDatabaseItem();
    viewer = new AstViewer();
    viewer.updateRoots(astRoots, item, defaultUri);

    const revealMock = jest.fn();

    (viewer as any).treeView.reveal = revealMock;
    Object.defineProperty((viewer as any).treeView, "visible", {
      value: true,
    });

    const mockEvent = createMockEvent(selectionRange, fileUri);
    (viewer as any).updateTreeSelection(mockEvent);
    if (expectedSelection) {
      expect(revealMock).toHaveBeenCalledWith(expectedSelection);
    } else {
      expect(revealMock).not.toHaveBeenCalled();
    }
  }

  function createMockEvent(selectionRange: Range | undefined, uri: Uri) {
    return {
      selections: [
        {
          anchor: selectionRange?.start,
          active: selectionRange?.end,
        },
      ],
      textEditor: {
        document: {
          uri: {
            fsPath: uri.fsPath,
          },
        },
      },
    };
  }

  function findNodeById(id: number, ast: any): any {
    if (Array.isArray(ast)) {
      for (const elt of ast) {
        const candidate = findNodeById(id, elt);
        if (candidate) {
          return candidate;
        }
      }
    } else if (typeof ast === "object" && ast) {
      if (ast.id === id) {
        return ast;
      } else {
        for (const [name, prop] of Object.entries(ast)) {
          if (name !== "parent") {
            const candidate = findNodeById(id, prop);
            if (candidate) {
              return candidate;
            }
          }
        }
      }
    }
  }

  async function buildAst() {
    const astRoots = load(
      await readFile(
        `${__dirname}/../../data/language-support/ast-viewer/ast-viewer.yml`,
        "utf8",
      ),
    ) as AstItem[];

    // convert range properties into vscode.Range instances
    function convertToRangeInstances(obj: any) {
      if (Array.isArray(obj)) {
        obj.forEach((elt) => convertToRangeInstances(elt));
      } else if (typeof obj === "object" && obj) {
        if ("range" in obj && "_start" in obj.range && "_end" in obj.range) {
          obj.range = new Range(
            obj.range._start._line,
            obj.range._start._character,
            obj.range._end._line,
            obj.range._end._character,
          );
        } else {
          Object.entries(obj).forEach(
            ([name, prop]) =>
              name !== "parent" && convertToRangeInstances(prop),
          );
        }
      }
    }
    convertToRangeInstances(astRoots);
    return astRoots;
  }
});
