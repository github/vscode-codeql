import {
  ExpandedDbItem,
  ExpandedDbItemKind,
} from "../../../src/databases/config/db-config";
import {
  RemoteUserDefinedListDbItem,
  RootRemoteDbItem,
} from "../../../src/databases/db-item";
import { calculateNewExpandedState } from "../../../src/databases/db-item-expansion";
import {
  createRemoteUserDefinedListDbItem,
  createRootRemoteDbItem,
} from "../../factories/db-item-factories";

describe("db item expansion", () => {
  it("should add an expanded item to an existing list", () => {
    const currentExpandedItems: ExpandedDbItem[] = [
      {
        kind: ExpandedDbItemKind.RootRemote,
      },
      {
        kind: ExpandedDbItemKind.RemoteUserDefinedList,
        listName: "list1",
      },
    ];

    const dbItem: RemoteUserDefinedListDbItem =
      createRemoteUserDefinedListDbItem({
        name: "list2",
      });

    const newExpandedItems = calculateNewExpandedState(
      currentExpandedItems,
      dbItem,
      true,
    );

    expect(newExpandedItems).toEqual([
      ...currentExpandedItems,
      {
        kind: ExpandedDbItemKind.RemoteUserDefinedList,
        listName: "list2",
      },
    ]);
  });

  it("should add an expanded item to an empty list", () => {
    const dbItem: RemoteUserDefinedListDbItem =
      createRemoteUserDefinedListDbItem({
        name: "list2",
      });

    const newExpandedItems = calculateNewExpandedState([], dbItem, true);

    expect(newExpandedItems).toEqual([
      {
        kind: ExpandedDbItemKind.RemoteUserDefinedList,
        listName: "list2",
      },
    ]);
  });

  it("should remove a collapsed item from a list", () => {
    const currentExpandedItems: ExpandedDbItem[] = [
      {
        kind: ExpandedDbItemKind.RootRemote,
      },
      {
        kind: ExpandedDbItemKind.RemoteUserDefinedList,
        listName: "list1",
      },
    ];

    const dbItem: RemoteUserDefinedListDbItem =
      createRemoteUserDefinedListDbItem({
        name: "list1",
      });

    const newExpandedItems = calculateNewExpandedState(
      currentExpandedItems,
      dbItem,
      false,
    );

    expect(newExpandedItems).toEqual([
      {
        kind: ExpandedDbItemKind.RootRemote,
      },
    ]);
  });

  it("should remove a collapsed item from a list that becomes empty", () => {
    const currentExpandedItems: ExpandedDbItem[] = [
      {
        kind: ExpandedDbItemKind.RootRemote,
      },
    ];

    const dbItem: RootRemoteDbItem = createRootRemoteDbItem();

    const newExpandedItems = calculateNewExpandedState(
      currentExpandedItems,
      dbItem,
      false,
    );

    expect(newExpandedItems).toEqual([]);
  });
});
