import { DisposableObject } from "../common/disposable-object";
import type { LanguageContextStore } from "../language-context-store";
import type { Event, TreeDataProvider } from "vscode";
import { EventEmitter, ThemeIcon, TreeItem } from "vscode";
import {
  QueryLanguage,
  getLanguageDisplayName,
} from "../common/query-language";

const ALL_LANGUAGE_SELECTION_OPTIONS = [
  undefined, // All languages
  QueryLanguage.Cpp,
  QueryLanguage.CSharp,
  QueryLanguage.Go,
  QueryLanguage.Java,
  QueryLanguage.Javascript,
  QueryLanguage.Python,
  QueryLanguage.Ruby,
  QueryLanguage.Swift,
];

// A tree view items consisting of of a language (or undefined for all languages)
// and a boolean indicating whether it is selected or not.
export class LanguageSelectionTreeViewItem extends TreeItem {
  constructor(
    public readonly language: QueryLanguage | undefined,
    public readonly selected: boolean = false,
  ) {
    const label = language ? getLanguageDisplayName(language) : "All languages";
    super(label);

    this.iconPath = selected ? new ThemeIcon("check") : undefined;
    this.contextValue = selected ? undefined : "canBeSelected";
  }
}

export class LanguageSelectionTreeDataProvider
  extends DisposableObject
  implements TreeDataProvider<LanguageSelectionTreeViewItem>
{
  private treeItems: LanguageSelectionTreeViewItem[];
  private readonly onDidChangeTreeDataEmitter = this.push(
    new EventEmitter<void>(),
  );

  public constructor(private readonly languageContext: LanguageContextStore) {
    super();

    this.treeItems = this.createTree();

    // If the language context changes, we need to update the tree.
    this.push(
      this.languageContext.onLanguageContextChanged(() => {
        this.treeItems = this.createTree();
        this.onDidChangeTreeDataEmitter.fire();
      }),
    );
  }

  public get onDidChangeTreeData(): Event<void> {
    return this.onDidChangeTreeDataEmitter.event;
  }

  public getTreeItem(item: LanguageSelectionTreeViewItem): TreeItem {
    return item;
  }

  public getChildren(
    item?: LanguageSelectionTreeViewItem,
  ): LanguageSelectionTreeViewItem[] {
    if (!item) {
      return this.treeItems;
    } else {
      return [];
    }
  }

  private createTree(): LanguageSelectionTreeViewItem[] {
    return ALL_LANGUAGE_SELECTION_OPTIONS.map((language) => {
      return new LanguageSelectionTreeViewItem(
        language,
        this.languageContext.isSelectedLanguage(language),
      );
    });
  }
}
