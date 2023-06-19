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

export function autoNameExtensionPack(
  name: string,
  language: string,
): ExtensionPackName | undefined {
  let packName = `${name}-${language}`;
  if (!packName.includes("/")) {
    packName = `pack/${packName}`;
  }

  const parts = packName.split("/");
  const sanitizedParts = parts.map((part) => sanitizeExtensionPackName(part));

  return {
    scope: sanitizedParts[0],
    // This will ensure there's only 1 slash
    name: sanitizedParts.slice(1).join("-"),
  };
}

function sanitizeExtensionPackName(name: string) {
  // Lowercase everything
  name = name.toLowerCase();

  // Replace all spaces, dots, and underscores with hyphens
  name = name.replaceAll(/[\s._]+/g, "-");

  // Replace all characters which are not allowed by empty strings
  name = name.replaceAll(/[^a-z0-9-]/g, "");

  // Remove any leading or trailing hyphens
  name = name.replaceAll(/^-|-$/g, "");

  // Remove any duplicate hyphens
  name = name.replaceAll(/-{2,}/g, "-");

  return name;
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
