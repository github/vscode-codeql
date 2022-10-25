import { describe, it, expect, jest, afterEach, beforeEach } from '@jest/globals';
import { commands } from 'vscode';
import { ChildEvalLogTreeItem, EvalLogTreeItem, EvalLogViewer } from '../../eval-log-viewer';
import { testDisposeHandler } from '../test-dispose-handler';
import { DisposableObject } from '../../pure/disposable-object';

describe('EvalLogViewer', () => {
  let roots: EvalLogTreeItem[];
  let viewer: EvalLogViewer;
  beforeEach(async () => {
    viewer = new EvalLogViewer();
  });

  jest.spyOn(commands, 'registerCommand').mockReturnValue(new class extends DisposableObject { }());
  jest.spyOn(commands, 'executeCommand').mockResolvedValue(undefined);

  afterEach(() => {
    if (viewer) {
      viewer.dispose(testDisposeHandler);
    }
  });

  it('should update the viewer\'s roots', () => {
    const rootItem1: EvalLogTreeItem = {
      label: 'root-1',
      children: []
    };

    const childItem1: ChildEvalLogTreeItem = {
      label: 'child-1',
      parent: rootItem1,
      children: [],
    };
    rootItem1.children.push(childItem1);

    const rootItem2: EvalLogTreeItem = {
      label: 'root-2',
      children: []
    };

    const childItem2: ChildEvalLogTreeItem = {
      label: 'child-2',
      parent: rootItem2,
      children: [],
    };
    rootItem2.children.push(childItem2);

    const childItem3: ChildEvalLogTreeItem = {
      label: 'child-3',
      parent: rootItem2,
      children: [],
    };
    rootItem2.children.push(childItem3);

    const grandchildItem1: ChildEvalLogTreeItem = {
      label: 'grandchild-1',
      parent: childItem3,
      children: []
    };
    childItem3.children.push(grandchildItem1);

    roots = [rootItem1, rootItem2];

    viewer.updateRoots(roots);

    expect((viewer as any).treeDataProvider.roots).toBe(roots);
    expect((viewer as any).treeView.message).toBe('Viewer for query run:');
  });

  it('should clear the viewer\'s roots', () => {
    viewer.dispose(testDisposeHandler);
    expect((viewer as any).treeDataProvider.roots.length).toBe(0);
  });
});
