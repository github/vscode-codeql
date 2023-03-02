import { ESLintUtils } from "@typescript-eslint/utils";

export const rule = ESLintUtils.RuleCreator.withoutDocs({
  create(context) {
    return {
      /**
       * Matching on:
       * TSAsExpression {
       *   type: "TSAsExpression"
       *   expression: Literal {
       *     type: "Literal"
       *     value: 1
       *     raw: "1"
       *     range: [10, 11]
       *     loc: {start, end}
       *   }
       *   typeAnnotation: TSUnknownKeyword {
       *     type: "TSUnknownKeyword"
       *     range: [15, 22]
       *     loc: {start, end}
       *   }
       *   range: [10, 22]
       *   loc: {start, end}
       * }
       */
      TSAsExpression(node) {
        if (node.typeAnnotation.type === "TSUnknownKeyword") {
          context.report({
            messageId: "noAsUnknown",
            node: node.typeAnnotation,
          });
        }
      },
    };
  },
  meta: {
    docs: {
      description: "Disallow `as unknown`",
      recommended: "error",
    },
    schema: [],
    type: "problem",
    messages: {
      noAsUnknown: "Forbidden `as unknown`",
    },
  },
  defaultOptions: [],
});
