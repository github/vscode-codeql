import { expect } from 'chai';
import sinon = require('sinon');
import { commands } from 'vscode';
import { ChildEvalLogTreeItem, EvalLogTreeItem, EvalLogVisualizer } from '../../eval-log-visualizer';
import { testDisposeHandler } from '../test-dispose-handler';

describe('EvalLogVisualizer', () => {
    let roots: EvalLogTreeItem[];
    let visualizer: EvalLogVisualizer;
    let sandbox: sinon.SinonSandbox;
    beforeEach(async () => {
      sandbox = sinon.createSandbox();

      visualizer = new EvalLogVisualizer();
  
      sandbox.stub(commands, 'registerCommand');
      sandbox.stub(commands, 'executeCommand');
    });

    afterEach(() => {
        sandbox.restore();
        if (visualizer) {
            visualizer.dispose(testDisposeHandler);
        }
    });

    it('should update the visualizer\'s roots', () => {        
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

        visualizer.updateRoots(roots); 
    
        expect((visualizer as any).treeDataProvider.roots).to.eq(roots);
        expect((visualizer as any).treeView.message).to.eq('Visualizer for query:');
    });

    it('should clear the visualizer\'s roots', () => {
        visualizer.dispose(testDisposeHandler);
        expect((visualizer as any).treeDataProvider.roots.length).to.eq(0);
    });
});