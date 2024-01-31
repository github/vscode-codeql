import { checkConsistency } from "../../../src/model-editor/consistency-check";
import { createSourceModeledMethod } from "../../factories/model-editor/modeled-method-factories";
import { createMethod } from "../../factories/model-editor/method-factories";

describe("checkConsistency", () => {
  const notifier = {
    missingMethod: jest.fn(),
    inconsistentSupported: jest.fn(),
  };

  beforeEach(() => {
    notifier.missingMethod.mockReset();
    notifier.inconsistentSupported.mockReset();
  });

  it("should call missingMethod when method is missing", () => {
    const modeledMethods = [createSourceModeledMethod()];

    checkConsistency(
      [],
      {
        "Microsoft.CodeAnalysis.CSharp.SyntaxFactory.SeparatedList`1(System.Collections.Generic.IEnumerable<TNode>)":
          modeledMethods,
      },
      notifier,
    );

    expect(notifier.missingMethod).toHaveBeenCalledWith(
      "Microsoft.CodeAnalysis.CSharp.SyntaxFactory.SeparatedList`1(System.Collections.Generic.IEnumerable<TNode>)",
      modeledMethods,
    );
    expect(notifier.inconsistentSupported).not.toHaveBeenCalled();
  });

  it("should call inconsistentSupported when support is inconsistent", () => {
    checkConsistency(
      [
        createMethod({
          signature:
            "Microsoft.CodeAnalysis.CSharp.SyntaxFactory.SeparatedList`1(System.Collections.Generic.IEnumerable<TNode>)",
          packageName: "Microsoft.CodeAnalysis.CSharp",
          typeName: "SyntaxFactory",
          methodName: "SeparatedList`1",
          methodParameters: "(System.Collections.Generic.IEnumerable<TNode>)",
          supported: false,
        }),
      ],
      {
        "Microsoft.CodeAnalysis.CSharp.SyntaxFactory.SeparatedList`1(System.Collections.Generic.IEnumerable<TNode>)":
          [createSourceModeledMethod({})],
      },
      notifier,
    );

    expect(notifier.inconsistentSupported).toHaveBeenCalledWith(
      "Microsoft.CodeAnalysis.CSharp.SyntaxFactory.SeparatedList`1(System.Collections.Generic.IEnumerable<TNode>)",
      true,
    );
    expect(notifier.missingMethod).not.toHaveBeenCalled();
  });

  it("should call no methods when consistent", () => {
    checkConsistency(
      [
        createMethod({
          signature:
            "Microsoft.CodeAnalysis.CSharp.SyntaxFactory.SeparatedList<TNode>(System.Collections.Generic.IEnumerable<TNode>)",
          packageName: "Microsoft.CodeAnalysis.CSharp",
          typeName: "SyntaxFactory",
          methodName: "SeparatedList<TNode>",
          methodParameters: "(System.Collections.Generic.IEnumerable<TNode>)",
          supported: true,
        }),
      ],
      {
        "Microsoft.CodeAnalysis.CSharp.SyntaxFactory.SeparatedList<TNode>(System.Collections.Generic.IEnumerable<TNode>)":
          [createSourceModeledMethod({})],
      },
      notifier,
    );

    expect(notifier.missingMethod).not.toHaveBeenCalled();
    expect(notifier.inconsistentSupported).not.toHaveBeenCalled();
  });
});
