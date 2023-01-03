import { getDbItemActions } from "../../../../src/databases/ui/db-tree-view-item-action";
import {
  createLocalDatabaseDbItem,
  createLocalListDbItem,
  createRemoteOwnerDbItem,
  createRemoteRepoDbItem,
  createRemoteSystemDefinedListDbItem,
  createRemoteUserDefinedListDbItem,
  createRootLocalDbItem,
  createRootRemoteDbItem,
} from "../../../factories/db-item-factories";

describe("getDbItemActions", () => {
  it("should return an empty array for root remote node", () => {
    const dbItem = createRootRemoteDbItem();

    const actions = getDbItemActions(dbItem);

    expect(actions).toEqual([]);
  });

  it("should return an empty array for root local node", () => {
    const dbItem = createRootLocalDbItem();

    const actions = getDbItemActions(dbItem);

    expect(actions).toEqual([]);
  });

  it("should set canBeSelected, canBeRemoved and canBeRenamed for local user defined db list", () => {
    const dbItem = createLocalListDbItem();

    const actions = getDbItemActions(dbItem);

    expect(actions).toEqual(["canBeSelected", "canBeRemoved", "canBeRenamed"]);
  });

  it("should set canBeSelected, canBeRemoved and canBeRenamed for local db", () => {
    const dbItem = createLocalDatabaseDbItem();

    const actions = getDbItemActions(dbItem);

    expect(actions).toEqual(["canBeSelected", "canBeRemoved", "canBeRenamed"]);
  });

  it("should set canBeSelected for remote system defined db list", () => {
    const dbItem = createRemoteSystemDefinedListDbItem();

    const actions = getDbItemActions(dbItem);

    expect(actions).toEqual(["canBeSelected"]);
  });

  it("should not set canBeSelected for remote system defined list that is already selected", () => {
    const dbItem = createRemoteSystemDefinedListDbItem({ selected: true });

    const actions = getDbItemActions(dbItem);

    expect(actions.length).toEqual(0);
  });

  it("should set canBeSelected, canBeRemoved and canBeRenamed for remote user defined db list", () => {
    const dbItem = createRemoteUserDefinedListDbItem();

    const actions = getDbItemActions(dbItem);

    expect(actions).toEqual(["canBeSelected", "canBeRemoved", "canBeRenamed"]);
  });

  it("should not set canBeSelected for remote user defined db list that is already selected", () => {
    const dbItem = createRemoteUserDefinedListDbItem({ selected: true });

    const actions = getDbItemActions(dbItem);

    expect(actions.includes("canBeSelected")).toBeFalsy();
  });

  it("should set canBeSelected, canBeRemoved, canBeOpenedOnGitHub for remote owner", () => {
    const dbItem = createRemoteOwnerDbItem();

    const actions = getDbItemActions(dbItem);

    expect(actions).toEqual([
      "canBeSelected",
      "canBeRemoved",
      "canBeOpenedOnGitHub",
    ]);
  });

  it("should set canBeSelected, canBeRemoved, canBeOpenedOnGitHub for remote db", () => {
    const dbItem = createRemoteRepoDbItem();

    const actions = getDbItemActions(dbItem);

    expect(actions).toEqual([
      "canBeSelected",
      "canBeRemoved",
      "canBeOpenedOnGitHub",
    ]);
  });

  it("should not set canBeSelected for remote db that is already selected", () => {
    const dbItem = createRemoteRepoDbItem({ selected: true });

    const actions = getDbItemActions(dbItem);

    expect(actions.includes("canBeSelected")).toBeFalsy();
  });
});
