import {
  QueryLanguage,
  getLanguageDisplayName,
} from "../../../../src/common/query-language";
import { LanguageContextStore } from "../../../../src/language-context-store";
import {
  LanguageSelectionTreeDataProvider,
  LanguageSelectionTreeViewItem,
} from "../../../../src/language-selection-panel/language-selection-data-provider";
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
      // Note that the internal order of C# and C / C++ is different from what is shown in the UI.
      [expectedLanguageNames[1], expectedLanguageNames[2]] = [
        expectedLanguageNames[2],
        expectedLanguageNames[1],
      ];
      const actualLanguagesNames = dataProvider.getChildren().map((item) => {
        return item.label;
      });

      expect(actualLanguagesNames).toEqual(expectedLanguageNames);
    });

    it("default selection is All languages", async () => {
      const items = dataProvider.getChildren();
      expectSelected(items, undefined);
    });

    it("When language is changed then the selected element change", async () => {
      await languageContext.setLanguageContext(QueryLanguage.CSharp);
      const items = dataProvider.getChildren();
      expectSelected(items, QueryLanguage.CSharp);
    });
  });
});
