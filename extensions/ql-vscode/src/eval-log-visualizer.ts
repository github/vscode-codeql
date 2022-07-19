import { window, TreeDataProvider, TreeView, TreeItem, ProviderResult, Event, EventEmitter, TreeItemCollapsibleState } from 'vscode';
import { commandRunner } from './commandRunner';
import { DisposableObject } from './pure/disposable-object';
import path = require('path');
import { showAndLogErrorMessage } from './helpers';

export interface EvalLogTreeItem {
    label?: string;
    children: ChildEvalLogTreeItem[];
}

export interface ChildEvalLogTreeItem extends EvalLogTreeItem {
    parent: ChildEvalLogTreeItem | EvalLogTreeItem;
}

/** Provides data from parsed CodeQL evaluator logs to be rendered in a tree view. */
class EvalLogDataProvider extends DisposableObject implements TreeDataProvider<EvalLogTreeItem> {
    public roots: EvalLogTreeItem[] = [];

    private _onDidChangeTreeData: EventEmitter<EvalLogTreeItem | undefined | null | void> = new EventEmitter<EvalLogTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: Event<EvalLogTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }
    
    getTreeItem(element: EvalLogTreeItem): TreeItem | Thenable<TreeItem> {
        const state = element.children.length
            ? TreeItemCollapsibleState.Collapsed
            : TreeItemCollapsibleState.None;
        const treeItem = new TreeItem(element.label || '', state);
        treeItem.tooltip = `${treeItem.label} || ''}`;
        return treeItem;
    }

    getChildren(element?: EvalLogTreeItem): ProviderResult<EvalLogTreeItem[]> {
        // If no item is passed, return the root.
        if (!element) {
            return this.roots ? this.roots : [];
        }
        // Otherwise it is called with an existing item, to load its children.
        return element.children;
    }
    
    getParent(element: ChildEvalLogTreeItem): ProviderResult<EvalLogTreeItem> {
        return element.parent;
    }
}

// Manages a tree visualizer of structured evaluator logs.
export class EvalLogVisualizer extends DisposableObject {
    private treeView: TreeView<EvalLogTreeItem>;
    private treeDataProvider: EvalLogDataProvider;

    constructor() {
        super();

        this.treeDataProvider = new EvalLogDataProvider();
        this.treeView = window.createTreeView('codeQLEvalLogVisualizer', {
            treeDataProvider: this.treeDataProvider,
            showCollapseAll: true
        });

        this.push(this.treeView);
        this.push(this.treeDataProvider);
        this.push(
            commandRunner('codeQLEvalLogVisualizer.clear', async () => {
              this.clear();
            })
        );   
    }

    private clear(): void {
        this.treeDataProvider.roots = [];
        this.treeDataProvider.refresh();
        this.treeView.message = undefined;
    }

    // Called when the Show Evaluator Log (Visualizer) command is run on a new query.

    // REVIEW: Should the tree be automatically updated every time a new query is run?
    // It can be kind of confusing if the current query results doesn't align with the current 
    // visualizer. Or maybe in the future the top-level of the tree should be a single query run?
    updateRoots(roots: EvalLogTreeItem[], evalLogPath: string): void {
        this.treeDataProvider.roots = roots;
        this.treeDataProvider.refresh();
        this.treeView.message = `Visualizer for ${path.basename(evalLogPath)}`;

        // Handle error on reveal. This could happen if
        // the tree view is disposed during the reveal.
        this.treeView.reveal(roots[0], { focus: false })?.then(
            () => { /**/ },
            err => showAndLogErrorMessage(err)
        );
    }
}
