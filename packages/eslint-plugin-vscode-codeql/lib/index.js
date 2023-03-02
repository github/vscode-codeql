"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  rules: () => rules
});
module.exports = __toCommonJS(src_exports);

// src/rules/no-as-unknown.ts
var import_utils = require("@typescript-eslint/utils");
var rule = import_utils.ESLintUtils.RuleCreator.withoutDocs({
  create(context) {
    return {
      /**
       * Matching on:
       * TSAsExpression {
       *   type: "TSAsExpression"
       *   expression: TSAsExpression {
       *     type: "TSAsExpression"
       *     expression: Literal {type, value, raw, range, loc}
       *       typeAnnotation: TSUnknownKeyword {
       *       type: "TSUnknownKeyword"
       *       range: [15, 22]
       *       loc: {start, end}
       *     }
       *     range: [10, 22]
       *     loc: {start, end}
       *   }
       *   typeAnnotation: TSNumberKeyword {type, range, loc}
       *   range: [10, 32]
       *   loc: {start, end}
       * }
       */
      TSAsExpression(node) {
        if (node.typeAnnotation.type === "TSUnknownKeyword") {
          context.report({
            messageId: "noAsUnknown",
            node: node.typeAnnotation
          });
        }
      }
    };
  },
  meta: {
    docs: {
      description: "Disallow `as unknown`",
      recommended: "error"
    },
    schema: [],
    type: "problem",
    messages: {
      noAsUnknown: "Forbidden `as unknown`"
    }
  },
  defaultOptions: []
});

// src/index.ts
var rules = {
  "no-as-unknown": rule
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  rules
});
