import { commands, ExtensionContext, ViewColumn } from 'vscode';
import { AbstractWebview, WebviewPanelConfig } from '../abstract-webview';
import { logger } from '../logging';
import { FromVariantAnalysisMessage, ToVariantAnalysisMessage } from '../pure/interface-types';
import { assertNever } from '../pure/helpers-pure';
import {
  VariantAnalysis,
  VariantAnalysisQueryLanguage,
  VariantAnalysisRepoStatus,
  VariantAnalysisScannedRepositoryResult,
  VariantAnalysisScannedRepositoryState,
  VariantAnalysisStatus
} from './shared/variant-analysis';
import { VariantAnalysisViewInterface, VariantAnalysisViewManager } from './variant-analysis-view-manager';

export class VariantAnalysisView extends AbstractWebview<ToVariantAnalysisMessage, FromVariantAnalysisMessage> implements VariantAnalysisViewInterface {
  public static readonly viewType = 'codeQL.variantAnalysis';

  public constructor(
    ctx: ExtensionContext,
    public readonly variantAnalysisId: number,
    private readonly manager: VariantAnalysisViewManager<VariantAnalysisView>,
  ) {
    super(ctx);

    manager.registerView(this);
  }

  public async openView() {
    this.getPanel().reveal(undefined, true);

    await this.waitForPanelLoaded();
  }

  public async updateView(variantAnalysis: VariantAnalysis): Promise<void> {
    if (!this.isShowingPanel) {
      return;
    }

    await this.postMessage({
      t: 'setVariantAnalysis',
      variantAnalysis,
    });
  }

  public async updateRepoState(repoState: VariantAnalysisScannedRepositoryState): Promise<void> {
    if (!this.isShowingPanel) {
      return;
    }

    await this.postMessage({
      t: 'setRepoStates',
      repoStates: [repoState],
    });
  }

  public async sendRepositoryResults(repositoryResult: VariantAnalysisScannedRepositoryResult[]): Promise<void> {
    if (!this.isShowingPanel) {
      return;
    }

    await this.postMessage({
      t: 'setRepoResults',
      repoResults: repositoryResult,
    });
  }

  protected getPanelConfig(): WebviewPanelConfig {
    return {
      viewId: VariantAnalysisView.viewType,
      title: `CodeQL Query Results for ${this.variantAnalysisId}`,
      viewColumn: ViewColumn.Active,
      preserveFocus: true,
      view: 'variant-analysis',
    };
  }

  protected onPanelDispose(): void {
    this.manager.unregisterView(this);
  }

  protected async onMessage(msg: FromVariantAnalysisMessage): Promise<void> {
    switch (msg.t) {
      case 'viewLoaded':
        this.onWebViewLoaded();

        void logger.log('Variant analysis view loaded');

        await this.postMessage({
          t: 'setVariantAnalysis',
          variantAnalysis: this.getVariantAnalysis(),
        });

        break;
      case 'stopVariantAnalysis':
        void logger.log(`Stop variant analysis: ${msg.variantAnalysisId}`);
        break;
      case 'requestRepositoryResults':
        void commands.executeCommand('codeQL.loadVariantAnalysisRepoResults', this.variantAnalysisId, msg.repositoryFullName);
        break;
      default:
        assertNever(msg);
    }
  }

  private getVariantAnalysis(): VariantAnalysis {
    return {
      id: this.variantAnalysisId,
      controllerRepoId: 1,
      actionsWorkflowRunId: 789263,
      query: {
        name: 'Example query',
        filePath: 'example.ql',
        language: VariantAnalysisQueryLanguage.Javascript,
      },
      databases: {},
      status: VariantAnalysisStatus.InProgress,
      scannedRepos: [
        {
          repository: {
            id: 1,
            fullName: 'octodemo/hello-world-1',
            private: false,
          },
          analysisStatus: VariantAnalysisRepoStatus.Pending,
        },
        {
          repository: {
            id: 2,
            fullName: 'octodemo/hello-world-2',
            private: false,
          },
          analysisStatus: VariantAnalysisRepoStatus.Pending,
        },
        {
          repository: {
            id: 3,
            fullName: 'octodemo/hello-world-3',
            private: false,
          },
          analysisStatus: VariantAnalysisRepoStatus.Pending,
        },
        {
          repository: {
            id: 4,
            fullName: 'octodemo/hello-world-4',
            private: false,
          },
          analysisStatus: VariantAnalysisRepoStatus.Pending,
        },
        {
          repository: {
            id: 5,
            fullName: 'octodemo/hello-world-5',
            private: false,
          },
          analysisStatus: VariantAnalysisRepoStatus.Pending,
        },
        {
          repository: {
            id: 6,
            fullName: 'octodemo/hello-world-6',
            private: false,
          },
          analysisStatus: VariantAnalysisRepoStatus.Pending,
        },
        {
          repository: {
            id: 7,
            fullName: 'octodemo/hello-world-7',
            private: false,
          },
          analysisStatus: VariantAnalysisRepoStatus.Pending,
        },
        {
          repository: {
            id: 8,
            fullName: 'octodemo/hello-world-8',
            private: false,
          },
          analysisStatus: VariantAnalysisRepoStatus.Pending,
        },
        {
          repository: {
            id: 9,
            fullName: 'octodemo/hello-world-9',
            private: false,
          },
          analysisStatus: VariantAnalysisRepoStatus.Pending,
        },
        {
          repository: {
            id: 10,
            fullName: 'octodemo/hello-world-10',
            private: false,
          },
          analysisStatus: VariantAnalysisRepoStatus.Pending,
        },
      ],
      skippedRepos: {
        notFoundRepos: {
          repositoryCount: 2,
          repositories: [
            {
              fullName: 'octodemo/hello-globe'
            },
            {
              fullName: 'octodemo/hello-planet'
            }
          ]
        },
        noCodeqlDbRepos: {
          repositoryCount: 4,
          repositories: [
            {
              id: 100,
              fullName: 'octodemo/no-db-1'
            },
            {
              id: 101,
              fullName: 'octodemo/no-db-2'
            },
            {
              id: 102,
              fullName: 'octodemo/no-db-3'
            },
            {
              id: 103,
              fullName: 'octodemo/no-db-4'
            }
          ]
        },
        overLimitRepos: {
          repositoryCount: 1,
          repositories: [
            {
              id: 201,
              fullName: 'octodemo/over-limit-1'
            }
          ]
        },
        accessMismatchRepos: {
          repositoryCount: 1,
          repositories: [
            {
              id: 205,
              fullName: 'octodemo/private'
            }
          ]
        }
      },
    };
  }
}
