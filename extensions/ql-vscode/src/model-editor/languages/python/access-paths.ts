import { parseAccessPathTokens } from "../../shared/access-paths";
import type { MethodDefinition } from "../../method";
import { EndpointType } from "../../method";

const memberTokenRegex = /^Member\[(.+)]$/;

// In Python, the type can contain both the package name and the type name.
export function parsePythonType(type: string) {
  // The first part is always the package name. All remaining parts are the type
  // name.

  const parts = type.split(".");
  const packageName = parts.shift() ?? "";

  return {
    packageName,
    typeName: parts.join("."),
  };
}

// The type name can also be specified in the type, so this will combine
// the already parsed type name and the type name from the access path.
export function parsePythonAccessPath(
  path: string,
  shortTypeName: string,
): {
  typeName: string;
  methodName: string;
  endpointType: EndpointType;
  path: string;
} {
  const tokens = parseAccessPathTokens(path);

  if (tokens.length === 0) {
    const typeName = shortTypeName.endsWith("!")
      ? shortTypeName.slice(0, -1)
      : shortTypeName;

    return {
      typeName,
      methodName: "",
      endpointType: EndpointType.Method,
      path: "",
    };
  }

  const typeParts = [];
  let endpointType = EndpointType.Function;
  // If a short type name was given and it doesn't end in a `!`, then this refers to a method.
  if (shortTypeName !== "" && !shortTypeName.endsWith("!")) {
    endpointType = EndpointType.Method;
  }

  let remainingTokens: typeof tokens = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const memberMatch = token.text.match(memberTokenRegex);
    if (memberMatch) {
      typeParts.push(memberMatch[1]);
    } else if (token.text === "Instance") {
      // Alternative way of specifying that this refers to a method.
      endpointType = EndpointType.Method;
    } else {
      remainingTokens = tokens.slice(i);
      break;
    }
  }

  const methodName = typeParts.pop() ?? "";
  let typeName = typeParts.join(".");
  const remainingPath = remainingTokens.map((token) => token.text).join(".");

  if (shortTypeName !== "") {
    if (shortTypeName.endsWith("!")) {
      // The actual type name is the name without the `!`.
      shortTypeName = shortTypeName.slice(0, -1);
    }

    if (typeName !== "") {
      typeName = `${shortTypeName}.${typeName}`;
    } else {
      typeName = shortTypeName;
    }
  }

  return {
    methodName,
    typeName,
    endpointType,
    path: remainingPath,
  };
}

export function parsePythonTypeAndPath(
  type: string,
  path: string,
): {
  packageName: string;
  typeName: string;
  methodName: string;
  endpointType: EndpointType;
  path: string;
} {
  const { packageName, typeName: shortTypeName } = parsePythonType(type);
  const {
    typeName,
    methodName,
    endpointType,
    path: remainingPath,
  } = parsePythonAccessPath(path, shortTypeName);

  return {
    packageName,
    typeName,
    methodName,
    endpointType,
    path: remainingPath,
  };
}

export function pythonMethodSignature(typeName: string, methodName: string) {
  return `${typeName}#${methodName}`;
}

export function pythonType(
  packageName: string,
  typeName: string,
  endpointType: EndpointType,
) {
  if (typeName !== "" && packageName !== "") {
    return `${packageName}.${typeName}${endpointType === EndpointType.Function ? "!" : ""}`;
  }

  return `${packageName}${typeName}`;
}

export function pythonMethodPath(methodName: string) {
  if (methodName === "") {
    return "";
  }

  return `Member[${methodName}]`;
}

export function pythonPath(methodName: string, path: string) {
  const methodPath = pythonMethodPath(methodName);
  if (methodPath === "") {
    return path;
  }

  if (path === "") {
    return methodPath;
  }

  return `${methodPath}.${path}`;
}

export function pythonEndpointType(
  method: Omit<MethodDefinition, "endpointType">,
  endpointKind: string | undefined,
): EndpointType {
  switch (endpointKind) {
    case "Function":
      return EndpointType.Function;
    case "InstanceMethod":
      return EndpointType.Method;
    case "ClassMethod":
      return EndpointType.ClassMethod;
    case "StaticMethod":
      return EndpointType.StaticMethod;
    case "InitMethod":
      return EndpointType.Constructor;
    case "Class":
      return EndpointType.Class;
  }

  // Legacy behavior for when the kind column is missing.
  if (
    method.methodParameters.startsWith("(self,") ||
    method.methodParameters === "(self)"
  ) {
    return EndpointType.Method;
  }
  return EndpointType.Function;
}

export function hasPythonSelfArgument(endpointType: EndpointType): boolean {
  // Instance methods and class methods both use `Argument[self]` for the first parameter. The first
  // parameter after self is called `Argument[0]`.
  return (
    endpointType === EndpointType.Method ||
    endpointType === EndpointType.ClassMethod
  );
}
