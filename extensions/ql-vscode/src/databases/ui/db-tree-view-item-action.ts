import type { DbItem } from "../db-item";
import { DbItemKind, isSelectableDbItem } from "../db-item";

type DbTreeViewItemAction =
  | "canBeSelected"
  | "canBeRemoved"
  | "canBeRenamed"
  | "canBeOpenedOnGitHub"
  | "canImportCodeSearch";

export function getDbItemActions(dbItem: DbItem): DbTreeViewItemAction[] {
  const actions: DbTreeViewItemAction[] = [];

  if (canBeSelected(dbItem)) {
    actions.push("canBeSelected");
  }
  if (canBeRemoved(dbItem)) {
    actions.push("canBeRemoved");
  }
  if (canBeRenamed(dbItem)) {
    actions.push("canBeRenamed");
  }
  if (canBeOpenedOnGitHub(dbItem)) {
    actions.push("canBeOpenedOnGitHub");
  }
  if (canImportCodeSearch(dbItem)) {
    actions.push("canImportCodeSearch");
  }
  return actions;
}

const dbItemKindsThatCanBeRemoved = [
  DbItemKind.RemoteUserDefinedList,
  DbItemKind.RemoteRepo,
  DbItemKind.RemoteOwner,
];

const dbItemKindsThatCanBeRenamed = [DbItemKind.RemoteUserDefinedList];

const dbItemKindsThatCanBeOpenedOnGitHub = [
  DbItemKind.RemoteOwner,
  DbItemKind.RemoteRepo,
];

function canBeSelected(dbItem: DbItem): boolean {
  return isSelectableDbItem(dbItem) && !dbItem.selected;
}

function canBeRemoved(dbItem: DbItem): boolean {
  return dbItemKindsThatCanBeRemoved.includes(dbItem.kind);
}

function canBeRenamed(dbItem: DbItem): boolean {
  return dbItemKindsThatCanBeRenamed.includes(dbItem.kind);
}

function canBeOpenedOnGitHub(dbItem: DbItem): boolean {
  return dbItemKindsThatCanBeOpenedOnGitHub.includes(dbItem.kind);
}

function canImportCodeSearch(dbItem: DbItem): boolean {
  return DbItemKind.RemoteUserDefinedList === dbItem.kind;
}

export function getGitHubUrl(
  dbItem: DbItem,
  githubUrl: URL,
): string | undefined {
  switch (dbItem.kind) {
    case DbItemKind.RemoteOwner:
      return new URL(`/${dbItem.ownerName}`, githubUrl).toString();
    case DbItemKind.RemoteRepo:
      return new URL(`/${dbItem.repoFullName}`, githubUrl).toString();
    default:
      return undefined;
  }
}
