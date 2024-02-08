import { parseAccessPathTokens } from "../../shared/access-paths";
import { EndpointType } from "../../method";

const methodTokenRegex = /^Method\[(.+)]$/;

export function parseRubyMethodFromPath(path: string): string {
  const tokens = parseAccessPathTokens(path);

  if (tokens.length === 0) {
    return "";
  }

  const match = tokens[0].text.match(methodTokenRegex);
  if (match) {
    return match[1];
  } else {
    return "";
  }
}

export function parseRubyAccessPath(path: string): {
  methodName: string;
  path: string;
} {
  const tokens = parseAccessPathTokens(path);

  if (tokens.length === 0) {
    return { methodName: "", path: "" };
  }

  const match = tokens[0].text.match(methodTokenRegex);

  if (match) {
    return {
      methodName: match[1],
      path: tokens
        .slice(1)
        .map((token) => token.text)
        .join("."),
    };
  } else {
    return { methodName: "", path: "" };
  }
}

export function rubyMethodSignature(typeName: string, methodName: string) {
  return `${typeName}#${methodName}`;
}

export function rubyMethodPath(methodName: string) {
  if (methodName === "") {
    return "";
  }

  return `Method[${methodName}]`;
}

export function rubyPath(methodName: string, path: string) {
  const methodPath = rubyMethodPath(methodName);
  if (methodPath === "") {
    return path;
  }

  return `${methodPath}.${path}`;
}

/** For the purpose of the model editor, we are defining the endpoint types as follows:
 * - Class: A class instance
 * - Module: The class itself
 * - Method: A method in a class
 * - Constructor: A constructor method
 * @param typeName
 * @param methodName
 */
export function rubyEndpointType(typeName: string, methodName: string) {
  if (typeName.endsWith("!") && methodName === "new") {
    // This is a constructor
    return EndpointType.Constructor;
  }

  if (typeName.endsWith("!") && methodName === "") {
    return EndpointType.Module;
  }

  if (methodName === "") {
    return EndpointType.Class;
  }

  return EndpointType.Method;
}
