import { parseAccessPathTokens } from "../../shared/access-paths";

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
