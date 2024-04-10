import { createFilenameFromString } from "../common/filenames";

const packNamePartRegex = /[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/;
const packNameRegex = new RegExp(
  `^(?<scope>${packNamePartRegex.source})/(?<name>${packNamePartRegex.source})$`,
);
const packNameLength = 128;

export interface ExtensionPackName {
  scope: string;
  name: string;
}

export function formatPackName(packName: ExtensionPackName): string {
  return `${packName.scope}/${packName.name}`;
}

export function sanitizePackName(userPackName: string): ExtensionPackName {
  let packName = userPackName;

  packName = packName.trim();

  while (packName.startsWith("/")) {
    packName = packName.slice(1);
  }

  while (packName.endsWith("/")) {
    packName = packName.slice(0, -1);
  }

  if (!packName.includes("/")) {
    packName = `pack/${packName}`;
  }

  const parts = packName.split("/");
  const sanitizedParts = parts.map((part) =>
    createFilenameFromString(part, {
      removeDots: true,
    }),
  );

  // If the scope is empty (e.g. if the given name is "-/b"), then we need to still set a scope
  if (sanitizedParts[0].length === 0) {
    sanitizedParts[0] = "pack";
  }

  return {
    scope: sanitizedParts[0],
    // This will ensure there's only 1 slash
    name: sanitizedParts.slice(1).join("-"),
  };
}

export function parsePackName(packName: string): ExtensionPackName | undefined {
  const matches = packNameRegex.exec(packName);
  if (!matches?.groups) {
    return;
  }

  const scope = matches.groups.scope;
  const name = matches.groups.name;

  return {
    scope,
    name,
  };
}

export function validatePackName(name: string): string | undefined {
  if (!name) {
    return "Pack name must not be empty";
  }

  if (name.length > packNameLength) {
    return `Pack name must be no longer than ${packNameLength} characters`;
  }

  const matches = packNameRegex.exec(name);
  if (!matches?.groups) {
    if (!name.includes("/")) {
      return "Invalid package name: a pack name must contain a slash to separate the scope from the pack name";
    }

    return "Invalid package name: a pack name must contain only lowercase ASCII letters, ASCII digits, and hyphens";
  }

  return undefined;
}
