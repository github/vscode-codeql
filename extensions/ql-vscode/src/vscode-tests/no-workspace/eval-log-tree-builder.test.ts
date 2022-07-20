import { expect } from 'chai';
import EvalLogTreeBuilder from '../../eval-log-tree-builder';
import { EvalLogData } from '../../pure/log-summary-parser';

describe('EvalLogTreeBuilder', () => {      
    it('should build the log tree roots', async () => {
        const builder = createLogTreeBuilder();
        const roots = await builder.getRoots();
        
        // Force children, parent to be undefined for ease of testing. 
        expect(roots.map(
          r => ({ ...r, children: undefined })
        )).to.deep.eq(expectedRoots);

        expect((roots[0].children.map(
           ra => ({ ...ra, children: undefined, parent: undefined }) 
        ))).to.deep.eq(expectedRA);
        
        // Pipeline steps' children should be empty so do not force undefined children here. 
        expect(roots[0].children[0].children.map(
            step => ({ ...step, parent: undefined }) 
        )).to.deep.eq(expectedPipelineSteps);
    });

    function createLogTreeBuilder() {
        return new EvalLogTreeBuilder(evalLogDataItems);
    }

    const evalLogDataItems: EvalLogData[] = [
        {
            queryCausingWork: 'test-query.ql',
            predicateName: 'quick_eval#query#ffffffff',
            millis: 1,
            resultSize: 596,
            ra: { 
                pipeline: [
                    '{1} r1',
                    '{2} r2',
                    'return r2'
                ] 
            },
        }
    ];

    const expectedRoots = [  
        {
            label: 'quick_eval#query#ffffffff - 596 tuples in 1 ms for query test-query.ql',
            children: undefined
        },
    ];

    const expectedRA = [  
        {
            label: 'Pipeline: pipeline',
            children: undefined,
            parent: undefined
        }
    ];

    const expectedPipelineSteps = [{
        label: '{1} r1',
        children: [],
        parent: undefined
    },
    {
        label: '{2} r2',
        children: [],
        parent: undefined
    },
    {
        label: 'return r2',
        children: [],
        parent: undefined
    }];
});