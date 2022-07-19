import { expect } from 'chai';
import EvalLogTreeBuilder from '../../eval-log-tree-builder';
import { EvalLogData } from '../../pure/log-summary-parser';

describe('EvalLogTreeBuilder', () => {      
    it('should build the log tree roots', async () => {
        const builder = createLogTreeBuilder();
        const roots = await builder.getRoots();
        
        expect(roots.map(
          r => ({ ...r, children: undefined })
        )).to.deep.eq(expectedRoots);
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
            ra: 
                    { pipeline: [
                        '{1} r1',
                        '{2} r2',
                        'return r2'
                    ] }
        }
    ];

    const expectedRoots = [  
        {
          label: 'quick_eval#query#ffffffff - 596 tuples in 1 ms for query test-query.ql',
          children: {
              label: 'Pipeline ID: pipeline',
              children: [
                    {
                        label: '{1} r1',
                        children: undefined
                    },
                    {
                        label: '{2} r2',
                        children: undefined
                    },
                    {
                        label: 'return r2',
                        children: undefined
                    }
            ]
          }
        },
    ];
});