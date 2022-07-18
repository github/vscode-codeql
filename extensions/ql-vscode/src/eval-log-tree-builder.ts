import { ChildEvalLogTreeItem, EvalLogTreeItem } from './eval-log-visualizer';
import { EvalLogData as EvalLogData } from './pure/log-summary-parser';

export default class EvalLogTreeBuilder {
    private evalLogDataItems: EvalLogData[];
    
    constructor(evaluatorLogDataItems: EvalLogData[]) {
        this.evalLogDataItems = evaluatorLogDataItems;
    }

    async getRoots(): Promise<EvalLogTreeItem[]> {
        return await this.parseRoots();
    }

    private async parseRoots(): Promise<EvalLogTreeItem[]> {
        const roots: EvalLogTreeItem[] = [];

        // For each item, create a TreeItem object with appropriate parents/children 
        this.evalLogDataItems.forEach(logDataItem => {

            // TODO(angelapwen): Once the viewer can show logs for multiple queries, then queries should be the root level.
            // Every object is a root except the RA for now
            const label = `${logDataItem.predicateName} - ${logDataItem.resultSize} tuples in ${logDataItem.millis} ms for query ${logDataItem.queryCausingWork}`;
            const rootItem: EvalLogTreeItem = {
                label: label,
                children: [] // Will assign pipeline items as children shortly.
            };

            for (const [pipelineName, steps] of Object.entries(logDataItem.ra)) {
                const pipelineLabel = `Pipeline ID: ${pipelineName}`;
                const pipelineItem: ChildEvalLogTreeItem = {
                    label: pipelineLabel,
                    parent: rootItem,
                    children: [] // Will assign step items as children shortly.
                };
                rootItem.children.push(pipelineItem);
        
                steps.forEach( (step: string) => {
                    const stepLabel = step;
                    const stepItem: ChildEvalLogTreeItem =  {
                        label: stepLabel,
                        parent: pipelineItem,
                        children: []
                    };
                    pipelineItem.children.push(stepItem);
                });
            }
            roots.push(rootItem);
        });
    return roots;
    }
}