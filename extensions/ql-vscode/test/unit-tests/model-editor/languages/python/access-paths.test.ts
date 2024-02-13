import {
  parsePythonAccessPath,
  pythonEndpointType,
  pythonPath,
} from "../../../../../src/model-editor/languages/python/access-paths";
import { EndpointType } from "../../../../../src/model-editor/method";

const testCases: Array<{
  path: string;
  method: ReturnType<typeof parsePythonAccessPath>;
}> = [
  {
    path: "Member[CommonTokens].Member[Class].Instance.Member[foo]",
    method: {
      typeName: "CommonTokens.Class",
      methodName: "foo",
      endpointType: EndpointType.Method,
      path: "",
    },
  },
  {
    path: "Member[CommonTokens].Member[Class].Instance.Member[foo].Parameter[self]",
    method: {
      typeName: "CommonTokens.Class",
      methodName: "foo",
      endpointType: EndpointType.Method,
      path: "Parameter[self]",
    },
  },
  {
    path: "Member[getSource].ReturnValue",
    method: {
      typeName: "",
      methodName: "getSource",
      endpointType: EndpointType.Function,
      path: "ReturnValue",
    },
  },
  {
    path: "Member[CommonTokens].Member[makePromise].ReturnValue.Awaited",
    method: {
      typeName: "CommonTokens",
      methodName: "makePromise",
      endpointType: EndpointType.Function,
      path: "ReturnValue.Awaited",
    },
  },
  {
    path: "Member[ArgPos].Member[anyParam].Argument[any]",
    method: {
      typeName: "ArgPos",
      methodName: "anyParam",
      endpointType: EndpointType.Function,
      path: "Argument[any]",
    },
  },
  {
    path: "Member[ArgPos].Instance.Member[self_thing].Argument[self]",
    method: {
      typeName: "ArgPos",
      methodName: "self_thing",
      endpointType: EndpointType.Method,
      path: "Argument[self]",
    },
  },
];

describe("parsePythonAccessPath", () => {
  it.each(testCases)("parses $path", ({ path, method }) => {
    expect(parsePythonAccessPath(path)).toEqual(method);
  });
});

describe("pythonPath", () => {
  it.each(testCases)("constructs $path", ({ path, method }) => {
    expect(
      pythonPath(
        method.typeName,
        method.methodName,
        method.endpointType,
        method.path,
      ),
    ).toEqual(path);
  });
});

describe("pythonEndpointType", () => {
  it("returns method for a method", () => {
    expect(
      pythonEndpointType({
        packageName: "testlib",
        typeName: "CommonTokens",
        methodName: "foo",
        methodParameters: "(self,a)",
      }),
    ).toEqual(EndpointType.Method);
  });

  it("returns function for a function", () => {
    expect(
      pythonEndpointType({
        packageName: "testlib",
        typeName: "CommonTokens",
        methodName: "foo",
        methodParameters: "(a)",
      }),
    ).toEqual(EndpointType.Function);
  });
});
