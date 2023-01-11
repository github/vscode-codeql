import { readFileSync } from "fs-extra";

import AstBuilder from "../../../../src/contextual/astBuilder";
import { CodeQLCliServer } from "../../../../src/cli";
import { DatabaseItem } from "../../../../src/databases";
import { Uri } from "vscode";
import { QueryWithResults } from "../../../../src/run-queries-shared";

/**
 *
This test uses an AST generated from this file (already BQRS-decoded in ../data/astBuilder.json):

#include <common.h>

int interrupt_init(void)
{
    return 0;
}

void enable_interrupts(void)
{
    return;
}
int disable_interrupts(void)
{
    return 0;
}
 */

describe("AstBuilder", () => {
  let mockCli: CodeQLCliServer;
  let overrides: Record<string, Record<string, unknown> | undefined>;

  beforeEach(() => {
    mockCli = {
      bqrsDecode: jest
        .fn()
        .mockImplementation(
          (_: string, resultSet: "nodes" | "edges" | "graphProperties") => {
            return mockDecode(resultSet);
          },
        ),
    } as unknown as CodeQLCliServer;
    overrides = {
      nodes: undefined,
      edges: undefined,
      graphProperties: undefined,
    };
  });

  it("should build the AST roots", async () => {
    const astBuilder = createAstBuilder();
    const roots = await astBuilder.getRoots();

    const options = { entities: ["id", "url", "string"] };
    expect(mockCli.bqrsDecode).toBeCalledWith("/a/b/c", "nodes", options);
    expect(mockCli.bqrsDecode).toBeCalledWith("/a/b/c", "edges", options);
    expect(mockCli.bqrsDecode).toBeCalledWith(
      "/a/b/c",
      "graphProperties",
      options,
    );

    expect(roots.map((r) => ({ ...r, children: undefined }))).toEqual(
      expectedRoots,
    );
  });

  it("should build an AST child without edge label", async () => {
    // just test one of the children to make sure that the structure is right
    // this label should only come from the node, not the edge
    const astBuilder = createAstBuilder();
    const roots = await astBuilder.getRoots();

    expect(roots[0].children[0].parent).toBe(roots[0]);
    // break the recursion
    (roots[0].children[0] as any).parent = undefined;
    (roots[0].children[0] as any).children = undefined;

    const child = {
      children: undefined,
      fileLocation: undefined,
      id: 26359,
      label: "params",
      location: {
        endColumn: 22,
        endLine: 19,
        startColumn: 5,
        startLine: 19,
        uri: "file:/opt/src/arch/sandbox/lib/interrupts.c",
      },
      order: 0,
      parent: undefined,
    };

    expect(roots[0].children[0]).toEqual(child);
  });

  it("should build an AST child with edge label", async () => {
    // just test one of the children to make sure that the structure is right
    // this label should only come from both the node and the edge
    const astBuilder = createAstBuilder();
    const roots = await astBuilder.getRoots();

    expect(roots[0].children[1].parent).toBe(roots[0]);
    // break the recursion
    (roots[0].children[1] as any).parent = undefined;
    (roots[0].children[1] as any).children = undefined;

    const child = {
      children: undefined,
      fileLocation: undefined,
      id: 26367,
      label: "body: [Block] { ... }",
      location: {
        endColumn: 1,
        endLine: 22,
        startColumn: 1,
        startLine: 20,
        uri: "file:/opt/src/arch/sandbox/lib/interrupts.c",
      },
      order: 2,
      parent: undefined,
    };

    expect(roots[0].children[1]).toEqual(child);
  });

  it("should fail when graphProperties are not correct", async () => {
    overrides.graphProperties = {
      tuples: [["semmle.graphKind", "hucairz"]],
    };

    const astBuilder = createAstBuilder();
    await expect(astBuilder.getRoots()).rejects.toThrow("AST is invalid");
  });

  function createAstBuilder() {
    return new AstBuilder(
      {
        query: {
          resultsPaths: {
            resultsPath: "/a/b/c",
          },
        },
      } as QueryWithResults,
      mockCli,
      {} as DatabaseItem,
      Uri.file(""),
    );
  }

  function mockDecode(resultSet: "nodes" | "edges" | "graphProperties") {
    if (overrides[resultSet]) {
      return overrides[resultSet];
    }

    const mapper = {
      nodes: 0,
      edges: 1,
      graphProperties: 2,
    };
    const index = mapper[resultSet] as number;
    if (index >= 0 && index <= 2) {
      return JSON.parse(
        readFileSync(`${__dirname}/../data/astBuilder.json`, "utf8"),
      )[index];
    } else {
      throw new Error(`Invalid resultSet: ${resultSet}`);
    }
  }
});

const expectedRoots = [
  {
    id: 0,
    label: "[TopLevelFunction] int disable_interrupts()",
    fileLocation: undefined,
    location: {
      uri: "file:/opt/src/arch/sandbox/lib/interrupts.c",
      startLine: 19,
      startColumn: 5,
      endLine: 19,
      endColumn: 22,
    },
    order: 3,
    children: undefined,
  },
  {
    id: 26363,
    label: "[TopLevelFunction] void enable_interrupts()",
    fileLocation: undefined,
    location: {
      uri: "file:/opt/src/arch/sandbox/lib/interrupts.c",
      startLine: 15,
      startColumn: 6,
      endLine: 15,
      endColumn: 22,
    },
    order: 2,
    children: undefined,
  },
  {
    id: 26364,
    label: "[TopLevelFunction] int interrupt_init()",
    fileLocation: undefined,
    location: {
      uri: "file:/opt/src/arch/sandbox/lib/interrupts.c",
      startLine: 10,
      startColumn: 5,
      endLine: 10,
      endColumn: 18,
    },
    order: 1,
    children: undefined,
  },
];
