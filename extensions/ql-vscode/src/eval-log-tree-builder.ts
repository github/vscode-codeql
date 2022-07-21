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

        if (this.evalLogDataItems.length == 0) {
            return roots; // Empty
        }

        // Once the viewer can show logs for multiple queries, there will be more than 1 item at the root
        // level. For now, there will always be one root (the one query being shown).
        const queryLabel = `${this.evalLogDataItems[0].queryCausingWork}`;
        const queryItem: EvalLogTreeItem = {
            label: queryLabel,
            children: [] // Will assign predicate items as children shortly.
        };

        // For each predicate, create a TreeItem object with appropriate parents/children 
        this.evalLogDataItems.forEach(logDataItem => {
            const predicateLabel = `${logDataItem.predicateName} (${logDataItem.resultSize} tuples, ${logDataItem.millis} ms)`;
            const predicateItem: ChildEvalLogTreeItem = {
                label: predicateLabel,
                parent: queryItem,
                children: [] // Will assign pipeline items as children shortly.
            };
            for (const [pipelineName, steps] of Object.entries(logDataItem.ra)) {
                const pipelineLabel = `Pipeline: ${pipelineName}`;
                const pipelineItem: ChildEvalLogTreeItem = {
                    label: pipelineLabel,
                    parent: predicateItem,
                    children: [] // Will assign step items as children shortly.
                };
                predicateItem.children.push(pipelineItem);
        
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
            queryItem.children.push(predicateItem);
        });
        roots.push(queryItem);
        return roots;
    }
}