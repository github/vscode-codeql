import {
  getDbItemActions,
  getGitHubUrl,
} from "../../../../src/databases/ui/db-tree-view-item-action";
import {
  createRemoteOwnerDbItem,
  createRemoteRepoDbItem,
  createRemoteSystemDefinedListDbItem,
  createRemoteUserDefinedListDbItem,
  createRootRemoteDbItem,
} from "../../../factories/db-item-factories";

describe("getDbItemActions", () => {
  it("should return an empty array for root remote node", () => {
    const dbItem = createRootRemoteDbItem();

    const actions = getDbItemActions(dbItem);

    expect(actions).toEqual([]);
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

  it("should set canBeSelected, canBeRemoved, canBeRenamed and canImportCodeSearch for remote user defined db list", () => {
    const dbItem = createRemoteUserDefinedListDbItem();

    const actions = getDbItemActions(dbItem);

    expect(actions).toEqual([
      "canBeSelected",
      "canBeRemoved",
      "canBeRenamed",
      "canImportCodeSearch",
    ]);
  });

  it("should not set canBeSelected for remote user defined db list that is already selected", () => {
    const dbItem = createRemoteUserDefinedListDbItem({
      selected: true,
    });

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

describe("getGitHubUrl", () => {
  it("should return the correct url for a remote owner", () => {
    const dbItem = createRemoteOwnerDbItem();

    const actualUrl = getGitHubUrl(dbItem);
    const expectedUrl = `https://github.com/${dbItem.ownerName}`;

    expect(actualUrl).toEqual(expectedUrl);
  });

  it("should return the correct url for a remote repo", () => {
    const dbItem = createRemoteRepoDbItem();

    const actualUrl = getGitHubUrl(dbItem);
    const expectedUrl = `https://github.com/${dbItem.repoFullName}`;

    expect(actualUrl).toEqual(expectedUrl);
  });

  it("should return undefined for other remote db items", () => {
    const dbItem0 = createRootRemoteDbItem();
    const dbItem1 = createRemoteSystemDefinedListDbItem();
    const dbItem2 = createRemoteUserDefinedListDbItem();

    const actualUrl0 = getGitHubUrl(dbItem0);
    const actualUrl1 = getGitHubUrl(dbItem1);
    const actualUrl2 = getGitHubUrl(dbItem2);

    expect(actualUrl0).toBeUndefined();
    expect(actualUrl1).toBeUndefined();
    expect(actualUrl2).toBeUndefined();
  });
});
