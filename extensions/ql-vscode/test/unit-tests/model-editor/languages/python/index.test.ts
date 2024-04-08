import type { MethodDefinition } from "../../../../../src/model-editor/method";
import { EndpointType } from "../../../../../src/model-editor/method";
import { python } from "../../../../../src/model-editor/languages/python";
import type { MethodArgumentOptions } from "../../../../../src/model-editor/languages";

const testCases: Array<{
  method: MethodDefinition;
  options: MethodArgumentOptions;
}> = [
  {
    method: {
      packageName: "requests",
      typeName: "Session",
      methodName: "foo",
      methodParameters: "(a,b,c)",
      endpointType: EndpointType.Function,
    },
    options: {
      options: [
        {
          path: "Argument[0,a:]",
          label: "Argument[0,a:]: a",
        },
        {
          path: "Argument[1,b:]",
          label: "Argument[1,b:]: b",
        },
        {
          path: "Argument[2,c:]",
          label: "Argument[2,c:]: c",
        },
      ],
      defaultArgumentPath: "Argument[0,a:]",
    },
  },
  {
    method: {
      packageName: "requests",
      typeName: "Session",
      methodName: "foo",
      methodParameters: "(self,a,b,c)",
      endpointType: EndpointType.Method,
    },
    options: {
      options: [
        {
          path: "Argument[self]",
          label: "Argument[self]: self",
        },
        {
          path: "Argument[0,a:]",
          label: "Argument[0,a:]: a",
        },
        {
          path: "Argument[1,b:]",
          label: "Argument[1,b:]: b",
        },
        {
          path: "Argument[2,c:]",
          label: "Argument[2,c:]: c",
        },
      ],
      defaultArgumentPath: "Argument[self]",
    },
  },
  {
    method: {
      packageName: "requests",
      typeName: "Session",
      methodName: "foo",
      methodParameters: "(a,b,c:)",
      endpointType: EndpointType.Function,
    },
    options: {
      options: [
        {
          path: "Argument[0,a:]",
          label: "Argument[0,a:]: a",
        },
        {
          path: "Argument[1,b:]",
          label: "Argument[1,b:]: b",
        },
        {
          path: "Argument[c:]",
          label: "Argument[c:]: c",
        },
      ],
      defaultArgumentPath: "Argument[0,a:]",
    },
  },
  {
    method: {
      packageName: "requests",
      typeName: "Session",
      methodName: "foo",
      methodParameters: "(a/,b,c:)",
      endpointType: EndpointType.Function,
    },
    options: {
      options: [
        {
          path: "Argument[0]",
          label: "Argument[0]: a",
        },
        {
          path: "Argument[1,b:]",
          label: "Argument[1,b:]: b",
        },
        {
          path: "Argument[c:]",
          label: "Argument[c:]: c",
        },
      ],
      defaultArgumentPath: "Argument[0]",
    },
  },
  {
    method: {
      packageName: "requests",
      typeName: "Session",
      methodName: "foo",
      methodParameters: "(self,a/,b/,c,d,e,f:,g:,h:)",
      endpointType: EndpointType.Method,
    },
    options: {
      options: [
        {
          path: "Argument[self]",
          label: "Argument[self]: self",
        },
        {
          path: "Argument[0]",
          label: "Argument[0]: a",
        },
        {
          path: "Argument[1]",
          label: "Argument[1]: b",
        },
        {
          path: "Argument[2,c:]",
          label: "Argument[2,c:]: c",
        },
        {
          path: "Argument[3,d:]",
          label: "Argument[3,d:]: d",
        },
        {
          path: "Argument[4,e:]",
          label: "Argument[4,e:]: e",
        },
        {
          path: "Argument[f:]",
          label: "Argument[f:]: f",
        },
        {
          path: "Argument[g:]",
          label: "Argument[g:]: g",
        },
        {
          path: "Argument[h:]",
          label: "Argument[h:]: h",
        },
      ],
      defaultArgumentPath: "Argument[self]",
    },
  },
  {
    method: {
      packageName: "requests",
      typeName: "Session",
      methodName: "foo",
      methodParameters: "(self)",
      endpointType: EndpointType.Method,
    },
    options: {
      options: [
        {
          path: "Argument[self]",
          label: "Argument[self]: self",
        },
      ],
      defaultArgumentPath: "Argument[self]",
    },
  },
  {
    method: {
      packageName: "requests",
      typeName: "Session",
      methodName: "foo",
      methodParameters: "()",
      endpointType: EndpointType.Function,
    },
    options: {
      options: [],
      defaultArgumentPath: "Argument[self]",
    },
  },
];

describe("getArgumentOptions", () => {
  it.each(testCases)(
    "returns the correct options for $method",
    ({ method, options }) => {
      expect(python.getArgumentOptions(method)).toEqual(options);
    },
  );
});
