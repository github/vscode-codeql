import {
  ThemeColor,
  ThemeIcon,
  TreeItem,
  TreeItemCollapsibleState,
  Uri,
} from "vscode";
import { Call, ExternalApiUsage } from "../external-api-usage";

export abstract class ModelingTreeItem extends TreeItem {
  protected constructor(
    resourceUri: Uri,
    label: string,
    description?: string,
    public readonly children: ModelingTreeItem[] = [],
  ) {
    super(
      label,
      children.length > 0
        ? TreeItemCollapsibleState.Collapsed
        : TreeItemCollapsibleState.None,
    );
    this.description = description;
    this.resourceUri = resourceUri;
  }
}

export class MethodModelingTreeItem extends ModelingTreeItem {
  constructor(method: ExternalApiUsage, children: ModelingTreeItem[]) {
    super(
      Uri.parse(
        `codeql-modeling://method/${encodeURIComponent(method.signature)}`,
      ),
      `${method.packageName}.${method.typeName}`,
      `${method.methodName}${method.methodParameters}`,
      children,
    );

    this.iconPath = new ThemeIcon("package");
  }
}

export class UsageModelingTreeItem extends ModelingTreeItem {
  constructor(method: ExternalApiUsage, usage: Call) {
    super(
      Uri.parse(
        `codeql-modeling://usage/${encodeURIComponent(
          method.signature,
        )}?uri=${encodeURIComponent(usage.url.uri)}&startLine=${
          usage.url.startLine
        }&startColumn=${usage.url.startColumn}&endLine=${
          usage.url.endLine
        }&endColumn=${usage.url.endColumn}`,
      ),
      usage.label,
      usage.url.uri,
    );

    this.iconPath = method.supported
      ? new ThemeIcon("pass", new ThemeColor("testing.iconPassed"))
      : new ThemeIcon("error", new ThemeColor("testing.iconFailed"));

    this.command = {
      title: "Open",
      command: "codeQLModeling.itemClicked",
      arguments: [this.resourceUri],
    };
  }
}
