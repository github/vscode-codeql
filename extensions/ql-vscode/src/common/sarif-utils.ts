import type { Location, Region } from "sarif";
import type { HighlightedRegion } from "../variant-analysis/shared/analysis-result";
import type { UrlValueResolvable } from "./raw-result-types";
import { isEmptyPath } from "./bqrs-utils";

export interface SarifLink {
  dest: number;
  text: string;
}

// The type of a result that has no associated location.
// hint is a string intended for display to the user
// that explains why there is no location.
interface NoLocation {
  hint: string;
}

type ParsedSarifLocation =
  | (UrlValueResolvable & {
      userVisibleFile: string;
    })
  // Resolvable locations have a `uri` field, but it will sometimes include
  // a source location prefix, which contains build-specific information the user
  // doesn't really need to see. We ensure that `userVisibleFile` will not contain
  // that, and is appropriate for display in the UI.
  | NoLocation;

type SarifMessageComponent = string | SarifLink;

/**
 * Unescape "[", "]" and "\\" like in sarif plain text messages
 */
export function unescapeSarifText(message: string): string {
  return message
    .replace(/\\\[/g, "[")
    .replace(/\\\]/g, "]")
    .replace(/\\\\/g, "\\");
}

export function parseSarifPlainTextMessage(
  message: string,
): SarifMessageComponent[] {
  const results: SarifMessageComponent[] = [];

  // We want something like "[linkText](4)", except that "[" and "]" may be escaped. The lookbehind asserts
  // that the initial [ is not escaped. Then we parse a link text with "[" and "]" escaped. Then we parse the numerical target.
  // Technically we could have any uri in the target but we don't output that yet.
  // The possibility of escaping outside the link is not mentioned in the sarif spec but we always output sartif this way.
  const linkRegex =
    /(?<=(?<!\\)(\\\\)*)\[(?<linkText>([^\\\][]|\\\\|\\\]|\\\[)*)\]\((?<linkTarget>[0-9]+)\)/g;
  let result: RegExpExecArray | null;
  let curIndex = 0;
  while ((result = linkRegex.exec(message)) !== null) {
    results.push(unescapeSarifText(message.substring(curIndex, result.index)));
    const linkText = result.groups!["linkText"];
    const linkTarget = +result.groups!["linkTarget"];
    results.push({ dest: linkTarget, text: unescapeSarifText(linkText) });
    curIndex = result.index + result[0].length;
  }
  results.push(unescapeSarifText(message.substring(curIndex, message.length)));
  return results;
}

/**
 * Computes a path normalized to reflect conventional normalization
 * of windows paths into zip archive paths.
 * @param sourceLocationPrefix The source location prefix of a database. May be
 * unix style `/foo/bar/baz` or windows-style `C:\foo\bar\baz`.
 * @param sarifRelativeUri A uri relative to sourceLocationPrefix.
 *
 * @returns A URI string that is valid for the `.file` field of a `FivePartLocation`:
 * directory separators are normalized, but drive letters `C:` may appear.
 */
export function getPathRelativeToSourceLocationPrefix(
  sourceLocationPrefix: string,
  sarifRelativeUri: string,
) {
  // convert a platform specific path into encoded path uri segments
  // need to be careful about drive letters and ensure that there
  // is a starting '/'
  let prefix = "";
  if (sourceLocationPrefix[1] === ":") {
    // assume this is a windows drive separator
    prefix = sourceLocationPrefix.substring(0, 2);
    sourceLocationPrefix = sourceLocationPrefix.substring(2);
  }
  const normalizedSourceLocationPrefix =
    prefix +
    sourceLocationPrefix
      .replace(/\\/g, "/")
      .split("/")
      .map(encodeURIComponent)
      .join("/");
  const slashPrefix = normalizedSourceLocationPrefix.startsWith("/") ? "" : "/";
  return `file:${
    slashPrefix + normalizedSourceLocationPrefix
  }/${sarifRelativeUri}`;
}

/**
 *
 * @param loc specifies the database-relative location of the source location
 * @param sourceLocationPrefix a file path (usually a full path) to the database containing the source location.
 */
export function parseSarifLocation(
  loc: Location,
  sourceLocationPrefix: string,
): ParsedSarifLocation {
  const physicalLocation = loc.physicalLocation;
  if (physicalLocation === undefined) {
    return { hint: "no physical location" };
  }
  if (physicalLocation.artifactLocation === undefined) {
    return { hint: "no artifact location" };
  }
  if (physicalLocation.artifactLocation.uri === undefined) {
    return { hint: "artifact location has no uri" };
  }
  if (isEmptyPath(physicalLocation.artifactLocation.uri)) {
    return { hint: "artifact location has empty uri" };
  }

  // This is not necessarily really an absolute uri; it could either be a
  // file uri or a relative uri.
  const uri = physicalLocation.artifactLocation.uri;

  const fileUriRegex = /^file:/;
  const hasFilePrefix = uri.match(fileUriRegex);
  const effectiveLocation = hasFilePrefix
    ? uri
    : getPathRelativeToSourceLocationPrefix(sourceLocationPrefix, uri);
  const userVisibleFile = decodeURIComponent(
    hasFilePrefix ? uri.replace(fileUriRegex, "") : uri,
  );

  if (physicalLocation.region === undefined) {
    // If the region property is absent, the physicalLocation object refers to the entire file.
    // Source: https://docs.oasis-open.org/sarif/sarif/v2.1.0/cs01/sarif-v2.1.0-cs01.html#_Toc16012638.
    return {
      type: "wholeFileLocation",
      uri: effectiveLocation,
      userVisibleFile,
    } as ParsedSarifLocation;
  } else {
    const region = parseSarifRegion(physicalLocation.region);

    return {
      type: "lineColumnLocation",
      uri: effectiveLocation,
      userVisibleFile,
      ...region,
    };
  }
}

export function parseSarifRegion(region: Region): {
  startLine: number;
  endLine: number;
  startColumn: number;
  endColumn: number;
} {
  // The SARIF we're given should have a startLine, but we
  // fall back to 1, just in case something has gone wrong.
  const startLine = region.startLine ?? 1;

  // These defaults are from SARIF 2.1.0 spec, section 3.30.2, "Text Regions"
  // https://docs.oasis-open.org/sarif/sarif/v2.1.0/cs01/sarif-v2.1.0-cs01.html#_Ref493492556
  const endLine = region.endLine === undefined ? startLine : region.endLine;
  const startColumn = region.startColumn === undefined ? 1 : region.startColumn;

  // Our tools should always supply `endColumn` field, which is fortunate, since
  // the SARIF spec says that it defaults to the end of the line, whose
  // length we don't know at this point in the code. We fall back to 1,
  // just in case something has gone wrong.
  //
  // It is off by one with respect to the way vscode counts columns in selections.
  const endColumn = (region.endColumn ?? 1) - 1;

  return {
    startLine,
    startColumn,
    endLine,
    endColumn,
  };
}

export function isNoLocation(loc: ParsedSarifLocation): loc is NoLocation {
  return "hint" in loc;
}

// Some helpers for highlighting specific regions from a SARIF code snippet

/**
 * Checks whether a particular line (determined by its line number in the original file)
 * is part of the highlighted region of a SARIF code snippet.
 */
export function shouldHighlightLine(
  lineNumber: number,
  highlightedRegion: HighlightedRegion,
): boolean {
  if (lineNumber < highlightedRegion.startLine) {
    return false;
  }

  if (highlightedRegion.endLine === undefined) {
    return lineNumber === highlightedRegion.startLine;
  }

  return lineNumber <= highlightedRegion.endLine;
}

/**
 * A line of code split into: plain text before the highlighted section, the highlighted
 * text itself, and plain text after the highlighted section.
 */
interface PartiallyHighlightedLine {
  plainSection1: string;
  highlightedSection: string;
  plainSection2: string;
}

/**
 * Splits a line of code into the highlighted and non-highlighted sections.
 */
export function parseHighlightedLine(
  line: string,
  lineNumber: number,
  highlightedRegion: HighlightedRegion,
): PartiallyHighlightedLine {
  const isSingleLineHighlight = highlightedRegion.endLine === undefined;
  const isFirstHighlightedLine = lineNumber === highlightedRegion.startLine;
  const isLastHighlightedLine = lineNumber === highlightedRegion.endLine;

  const highlightStartColumn = isSingleLineHighlight
    ? highlightedRegion.startColumn
    : isFirstHighlightedLine
      ? highlightedRegion.startColumn
      : 0;

  const highlightEndColumn = isSingleLineHighlight
    ? highlightedRegion.endColumn
    : isLastHighlightedLine
      ? highlightedRegion.endColumn
      : line.length + 1;

  const plainSection1 = line.substring(0, highlightStartColumn - 1);
  const highlightedSection = line.substring(
    highlightStartColumn - 1,
    highlightEndColumn - 1,
  );
  const plainSection2 = line.substring(highlightEndColumn - 1, line.length);

  return { plainSection1, highlightedSection, plainSection2 };
}
