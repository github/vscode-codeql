import { parseAccessPathTokens } from "../../shared/access-paths";
import type { MethodDefinition } from "../../method";
import { EndpointType } from "../../method";

const memberTokenRegex = /^Member\[(.+)]$/;

export function parsePythonAccessPath(path: string): {
  typeName: string;
  methodName: string;
  endpointType: EndpointType;
  path: string;
} {
  const tokens = parseAccessPathTokens(path);

  if (tokens.length === 0) {
    return {
      typeName: "",
      methodName: "",
      endpointType: EndpointType.Method,
      path: "",
    };
  }

  const typeParts = [];
  let endpointType = EndpointType.Function;

  let remainingTokens: typeof tokens = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const memberMatch = token.text.match(memberTokenRegex);
    if (memberMatch) {
      typeParts.push(memberMatch[1]);
    } else if (token.text === "Instance") {
      endpointType = EndpointType.Method;
    } else {
      remainingTokens = tokens.slice(i);
      break;
    }
  }

  const methodName = typeParts.pop() ?? "";
  const typeName = typeParts.join(".");
  const remainingPath = remainingTokens.map((token) => token.text).join(".");

  return {
    methodName,
    typeName,
    endpointType,
    path: remainingPath,
  };
}

export function pythonMethodSignature(typeName: string, methodName: string) {
  return `${typeName}#${methodName}`;
}

function pythonTypePath(typeName: string) {
  if (typeName === "") {
    return "";
  }

  return typeName
    .split(".")
    .map((part) => `Member[${part}]`)
    .join(".");
}

export function pythonMethodPath(
  typeName: string,
  methodName: string,
  endpointType: EndpointType,
) {
  if (methodName === "") {
    return pythonTypePath(typeName);
  }

  const typePath = pythonTypePath(typeName);

  let result = typePath;
  if (typePath !== "" && endpointType === EndpointType.Method) {
    result += ".Instance";
  }

  if (result !== "") {
    result += ".";
  }

  result += `Member[${methodName}]`;

  return result;
}

export function pythonPath(
  typeName: string,
  methodName: string,
  endpointType: EndpointType,
  path: string,
) {
  const methodPath = pythonMethodPath(typeName, methodName, endpointType);
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
): EndpointType {
  if (method.methodParameters.startsWith("(self,")) {
    return EndpointType.Method;
  }
  return EndpointType.Function;
}
