import {
  RemoteUserDefinedListDbItem,
  RootRemoteDbItem,
} from "../../../src/databases/db-item";
import {
  updateItemInExpandedState,
  ExpandedDbItem,
  ExpandedDbItemKind,
} from "../../../src/databases/db-item-expansion";
import {
  createRemoteUserDefinedListDbItem,
  createRootRemoteDbItem,
} from "../../factories/db-item-factories";

describe("db item expansion", () => {
  describe("updateItemInExpandedState", () => {
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
          listName: "list2",
        });

      const newExpandedItems = updateItemInExpandedState(
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
          listName: "list2",
        });

      const newExpandedItems = updateItemInExpandedState([], dbItem, true);

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
          listName: "list1",
        });

      const newExpandedItems = updateItemInExpandedState(
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

      const newExpandedItems = updateItemInExpandedState(
        currentExpandedItems,
        dbItem,
        false,
      );

      expect(newExpandedItems).toEqual([]);
    });
  });
});
