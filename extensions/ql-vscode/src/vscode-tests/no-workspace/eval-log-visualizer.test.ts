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

    it('should update the visualizer roots', () => {
        const evalLogPath = 'test-path.json';
        
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

        visualizer.updateRoots(roots, evalLogPath); 
    
        expect((visualizer as any).treeDataProvider.roots).to.eq(roots);
        expect((visualizer as any).treeView.message).to.eq(`Visualizer for ${evalLogPath}`);
    });

    it('should clear the visualizer\'s roots', () => {
        // REVIEW: I can't call visualizer.clear() here unless I make the function public, but
        // I'm not sure it's worth making it public just for the sake of testing. Or is there a 
        // way to call the "Clear" command in these tests?
    });
});