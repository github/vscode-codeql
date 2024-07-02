import {
  parsePythonAccessPath,
  parsePythonType,
  pythonEndpointType,
  pythonPath,
} from "../../../../../src/model-editor/languages/python/access-paths";
import { EndpointType } from "../../../../../src/model-editor/method";

describe("parsePythonType", () => {
  it("parses a type with a package", () => {
    expect(parsePythonType("requests.utils")).toEqual({
      packageName: "requests",
      typeName: "utils",
    });
  });

  it("parses a nested type with a package", () => {
    expect(parsePythonType("requests.adapters.HTTPAdapter")).toEqual({
      packageName: "requests",
      typeName: "adapters.HTTPAdapter",
    });
  });

  it("parses a package without a type", () => {
    expect(parsePythonType("requests")).toEqual({
      packageName: "requests",
      typeName: "",
    });
  });

  it("parses an empty string", () => {
    expect(parsePythonType("")).toEqual({
      packageName: "",
      typeName: "",
    });
  });
});

const testCases: Array<{
  path: string;
  shortTypeName: string;
  method: ReturnType<typeof parsePythonAccessPath>;
}> = [
  {
    path: "Member[CommonTokens].Member[Class].Instance.Member[foo]",
    shortTypeName: "",
    method: {
      typeName: "CommonTokens.Class",
      methodName: "foo",
      endpointType: EndpointType.Method,
      path: "",
    },
  },
  {
    path: "Member[foo]",
    shortTypeName: "CommonTokens.Class",
    method: {
      typeName: "CommonTokens.Class",
      methodName: "foo",
      endpointType: EndpointType.Method,
      path: "",
    },
  },
  {
    path: "Member[CommonTokens].Member[Class].Instance.Member[foo].Parameter[self]",
    shortTypeName: "",
    method: {
      typeName: "CommonTokens.Class",
      methodName: "foo",
      endpointType: EndpointType.Method,
      path: "Parameter[self]",
    },
  },
  {
    path: "Member[foo].Parameter[self]",
    shortTypeName: "CommonTokens.Class",
    method: {
      typeName: "CommonTokens.Class",
      methodName: "foo",
      endpointType: EndpointType.Method,
      path: "Parameter[self]",
    },
  },
  {
    path: "Member[getSource].ReturnValue",
    shortTypeName: "",
    method: {
      typeName: "",
      methodName: "getSource",
      endpointType: EndpointType.Function,
      path: "ReturnValue",
    },
  },
  {
    path: "Member[CommonTokens].Member[makePromise].ReturnValue.Awaited",
    shortTypeName: "",
    method: {
      typeName: "CommonTokens",
      methodName: "makePromise",
      endpointType: EndpointType.Function,
      path: "ReturnValue.Awaited",
    },
  },
  {
    path: "Member[makePromise].ReturnValue.Awaited",
    shortTypeName: "CommonTokens!",
    method: {
      typeName: "CommonTokens",
      methodName: "makePromise",
      endpointType: EndpointType.Function,
      path: "ReturnValue.Awaited",
    },
  },
  {
    path: "Member[ArgPos].Member[anyParam].Argument[any]",
    shortTypeName: "",
    method: {
      typeName: "ArgPos",
      methodName: "anyParam",
      endpointType: EndpointType.Function,
      path: "Argument[any]",
    },
  },
  {
    path: "Member[anyParam].Argument[any]",
    shortTypeName: "ArgPos!",
    method: {
      typeName: "ArgPos",
      methodName: "anyParam",
      endpointType: EndpointType.Function,
      path: "Argument[any]",
    },
  },
  {
    path: "Member[ArgPos].Instance.Member[self_thing].Argument[self]",
    shortTypeName: "",
    method: {
      typeName: "ArgPos",
      methodName: "self_thing",
      endpointType: EndpointType.Method,
      path: "Argument[self]",
    },
  },
  {
    path: "Member[self_thing].Argument[self]",
    shortTypeName: "ArgPos",
    method: {
      typeName: "ArgPos",
      methodName: "self_thing",
      endpointType: EndpointType.Method,
      path: "Argument[self]",
    },
  },
];

describe("parsePythonAccessPath", () => {
  it.each(testCases)(
    "parses $path with $shortTypeName",
    ({ path, shortTypeName, method }) => {
      expect(parsePythonAccessPath(path, shortTypeName)).toEqual(method);
    },
  );
});

describe("pythonPath", () => {
  it("returns empty for an empty method name", () => {
    expect(pythonPath("", "ReturnValue")).toEqual("ReturnValue");
  });

  it("returns empty for an empty path", () => {
    expect(pythonPath("foo", "")).toEqual("Member[foo]");
  });

  it("returns correctly for a full method name and path", () => {
    expect(pythonPath("foo", "ReturnValue")).toEqual("Member[foo].ReturnValue");
  });
});

describe("pythonEndpointType", () => {
  it("returns method for a method", () => {
    expect(
      pythonEndpointType(
        {
          packageName: "testlib",
          typeName: "CommonTokens",
          methodName: "foo",
          methodParameters: "(self,a)",
        },
        "InstanceMethod",
      ),
    ).toEqual(EndpointType.Method);
  });

  it("returns class method for a class method", () => {
    expect(
      pythonEndpointType(
        {
          packageName: "testlib",
          typeName: "CommonTokens",
          methodName: "foo",
          methodParameters: "(cls,a)",
        },
        "ClassMethod",
      ),
    ).toEqual(EndpointType.ClassMethod);
  });

  it("returns static method for a static method", () => {
    expect(
      pythonEndpointType(
        {
          packageName: "testlib",
          typeName: "CommonTokens",
          methodName: "foo",
          methodParameters: "(a)",
        },
        "StaticMethod",
      ),
    ).toEqual(EndpointType.StaticMethod);
  });

  it("returns function for a function", () => {
    expect(
      pythonEndpointType(
        {
          packageName: "testlib",
          typeName: "",
          methodName: "foo",
          methodParameters: "(a)",
        },
        "Function",
      ),
    ).toEqual(EndpointType.Function);
  });

  it("returns constructor for an init method", () => {
    expect(
      pythonEndpointType(
        {
          packageName: "testlib",
          typeName: "CommonTokens",
          methodName: "foo",
          methodParameters: "(a)",
        },
        "InitMethod",
      ),
    ).toEqual(EndpointType.Constructor);
  });

  it("returns class for a class", () => {
    expect(
      pythonEndpointType(
        {
          packageName: "testlib",
          typeName: "CommonTokens",
          methodName: "",
          methodParameters: "",
        },
        "Class",
      ),
    ).toEqual(EndpointType.Class);
  });

  it("returns method for a method without endpoint kind", () => {
    expect(
      pythonEndpointType(
        {
          packageName: "testlib",
          typeName: "CommonTokens",
          methodName: "foo",
          methodParameters: "(self,a)",
        },
        undefined,
      ),
    ).toEqual(EndpointType.Method);
  });

  it("returns function for a function without endpoint kind", () => {
    expect(
      pythonEndpointType(
        {
          packageName: "testlib",
          typeName: "CommonTokens",
          methodName: "foo",
          methodParameters: "(a)",
        },
        undefined,
      ),
    ).toEqual(EndpointType.Function);
  });
});
