import {
  QueryLanguage,
  getLanguageDisplayName,
} from "../../../../src/common/query-language";
import { LanguageContextStore } from "../../../../src/language-context-store";
import type { LanguageSelectionTreeViewItem } from "../../../../src/language-selection-panel/language-selection-data-provider";
import { LanguageSelectionTreeDataProvider } from "../../../../src/language-selection-panel/language-selection-data-provider";
import { createMockApp } from "../../../__mocks__/appMock";
import { EventEmitter, ThemeIcon } from "vscode";

describe("LanguageSelectionTreeDataProvider", () => {
  function expectSelected(
    items: LanguageSelectionTreeViewItem[],
    expected: QueryLanguage | undefined,
  ) {
    items.forEach((item) => {
      if (item.language === expected) {
        expect(item.selected).toBe(true);
        expect(item.iconPath).toEqual(new ThemeIcon("check"));
      } else {
        expect(item.selected).toBe(false);
        expect(item.iconPath).toBe(undefined);
      }
    });
  }

  describe("getChildren", () => {
    const app = createMockApp({
      createEventEmitter: <T>() => new EventEmitter<T>(),
    });
    const languageContext = new LanguageContextStore(app);
    const dataProvider = new LanguageSelectionTreeDataProvider(languageContext);

    it("returns list of all languages", async () => {
      const expectedLanguageNames = [
        "All languages",
        ...Object.values(QueryLanguage).map((language) => {
          return getLanguageDisplayName(language);
        }),
      ];
      const actualLanguagesNames = dataProvider.getChildren().map((item) => {
        return item.label;
      });

      // Note that the internal order of C# and C / C++ is different from what is shown in the UI.
      // So we sort to make sure we can compare the two lists.
      expect(actualLanguagesNames.sort()).toEqual(expectedLanguageNames.sort());
    });

    it("has a default selection of All languages", async () => {
      const items = dataProvider.getChildren();
      expectSelected(items, undefined);
    });

    it("changes the selected element when the language is changed", async () => {
      await languageContext.setLanguageContext(QueryLanguage.CSharp);
      const items = dataProvider.getChildren();
      expectSelected(items, QueryLanguage.CSharp);
    });
  });
});
