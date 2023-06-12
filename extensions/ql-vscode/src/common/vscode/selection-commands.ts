import {
  ExplorerSelectionCommandFunction,
  TreeViewContextMultiSelectionCommandFunction,
  TreeViewContextSingleSelectionCommandFunction,
} from "../commands";
import { showAndLogErrorMessage } from "./log";
import { extLogger } from "../logging";

// A hack to match types that are not an array, which is useful to help avoid
// misusing createSingleSelectionCommand, e.g. where T accidentally gets instantiated
// as DatabaseItem[] instead of DatabaseItem.
type NotArray = object & { length?: never };

// A way to get the type system to help assert that one type is a supertype of another.
type CreateSupertypeOf<Super, Sub extends Super> = Sub;

// This asserts that SelectionCommand is assignable to all of the different types of
// SelectionCommand defined in commands.ts. The intention is the output from the helpers
// in this file can be used with any of the select command types and can handle any of
// the inputs.
type SelectionCommand<T extends NotArray> = CreateSupertypeOf<
  TreeViewContextMultiSelectionCommandFunction<T> &
    TreeViewContextSingleSelectionCommandFunction<T> &
    ExplorerSelectionCommandFunction<T>,
  (singleItem: T, multiSelect?: T[] | undefined) => Promise<void>
>;

export function createSingleSelectionCommand<T extends NotArray>(
  f: (argument: T) => Promise<void>,
  itemName: string,
): SelectionCommand<T> {
  return async (singleItem, multiSelect) => {
    if (multiSelect === undefined || multiSelect.length === 1) {
      return f(singleItem);
    } else {
      void showAndLogErrorMessage(
        extLogger,
        `Please select a single ${itemName}.`,
      );
      return;
    }
  };
}

export function createMultiSelectionCommand<T extends NotArray>(
  f: (argument: T[]) => Promise<void>,
): SelectionCommand<T> {
  return async (singleItem, multiSelect) => {
    if (multiSelect !== undefined && multiSelect.length > 0) {
      return f(multiSelect);
    } else {
      return f([singleItem]);
    }
  };
}
