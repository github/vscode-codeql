import { window, TreeDataProvider, TreeView, TreeItem, ProviderResult, Event, EventEmitter, TreeItemCollapsibleState } from 'vscode';
import { commandRunner } from './commandRunner';
import { DisposableObject } from './pure/disposable-object';
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
            return this.roots || [];
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
    updateRoots(roots: EvalLogTreeItem[]): void {
        this.treeDataProvider.roots = roots;
        this.treeDataProvider.refresh();

        if (roots.length == 0) {
            this.treeView.message = 'No predicates evaluated in this query run.';
        } else {
            this.treeView.message = 'Visualizer for query:'; // Currently only one query supported at a time. 
        }

        // Handle error on reveal. This could happen if
        // the tree view is disposed during the reveal.
        this.treeView.reveal(roots[0], { focus: false })?.then(
            () => { /**/ },
            err => showAndLogErrorMessage(err)
        );
    }
}
