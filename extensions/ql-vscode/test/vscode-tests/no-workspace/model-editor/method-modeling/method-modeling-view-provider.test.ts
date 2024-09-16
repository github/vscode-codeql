import type { Uri, Webview, WebviewView } from "vscode";
import type { ModelConfigListener } from "../../../../../src/config";
import { MethodModelingViewProvider } from "../../../../../src/model-editor/method-modeling/method-modeling-view-provider";
import { createMockApp } from "../../../../__mocks__/appMock";
import { createMockModelingStore } from "../../../../__mocks__/model-editor/modelingStoreMock";
import { mockedObject } from "../../../../mocked-object";
import type {
  FromMethodModelingMessage,
  ToMethodModelingMessage,
} from "../../../../../src/common/interface-types";
import { DisposableObject } from "../../../../../src/common/disposable-object";
import { ModelingEvents } from "../../../../../src/model-editor/modeling-events";
import type {
  DbModelingState,
  ModelingStore,
  SelectedMethodDetails,
} from "../../../../../src/model-editor/modeling-store";
import { mockDatabaseItem } from "../../../utils/mocking.helpers";
import {
  createMethod,
  createUsage,
} from "../../../../factories/model-editor/method-factories";
import { QueryLanguage } from "../../../../../src/common/query-language";

describe("method modeling view provider", () => {
  // Modeling store
  let getStateForActiveDb: jest.MockedFunction<
    ModelingStore["getStateForActiveDb"]
  >;
  let getSelectedMethodDetails: jest.MockedFunction<
    ModelingStore["getSelectedMethodDetails"]
  >;

  // View provider
  let viewProvider: MethodModelingViewProvider;
  let onDidReceiveMessage: (msg: FromMethodModelingMessage) => Promise<void>;
  let postMessage: (message: unknown) => Promise<boolean>;

  beforeEach(async () => {
    const app = createMockApp({});

    getStateForActiveDb = jest.fn().mockReturnValue(undefined);
    getSelectedMethodDetails = jest.fn().mockReturnValue(undefined);
    const modelingStore = createMockModelingStore({
      getStateForActiveDb,
      getSelectedMethodDetails,
    });

    const modelingEvents = new ModelingEvents(app);

    const modelConfigListener = mockedObject<ModelConfigListener>({
      flowGeneration: true,
      onDidChangeConfiguration: jest.fn(),
    });

    viewProvider = new MethodModelingViewProvider(
      app,
      modelingStore,
      modelingEvents,
      modelConfigListener,
    );

    postMessage = jest.fn().mockResolvedValue(true);
    const webview: Webview = {
      options: {},
      html: "",
      onDidReceiveMessage: (listener) => {
        onDidReceiveMessage = listener;
        return new DisposableObject();
      },
      postMessage,
      asWebviewUri: (uri: Uri) => uri,
      cspSource: "",
    };

    const webviewView = mockedObject<WebviewView>({
      webview,
      onDidDispose: jest.fn(),
    });

    viewProvider.resolveWebviewView(webviewView);

    expect(onDidReceiveMessage).toBeDefined();
  });

  it("should load webview when no active DB", async () => {
    await onDidReceiveMessage({
      t: "viewLoaded",
      viewName: MethodModelingViewProvider.viewType,
    });

    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith({
      t: "setMethodModelingPanelViewState",
      viewState: {
        language: undefined,
        modelConfig: {
          flowGeneration: true,
        },
      },
    } satisfies ToMethodModelingMessage);
  });

  it("should load webview when active DB but no selected method", async () => {
    const dbModelingState = mockedObject<DbModelingState>({
      databaseItem: mockDatabaseItem({
        language: "java",
      }),
    });
    getStateForActiveDb.mockReturnValue(dbModelingState);

    await onDidReceiveMessage({
      t: "viewLoaded",
      viewName: MethodModelingViewProvider.viewType,
    });

    expect(postMessage).toHaveBeenCalledTimes(3);
    expect(postMessage).toHaveBeenNthCalledWith(1, {
      t: "setMethodModelingPanelViewState",
      viewState: {
        language: undefined,
        modelConfig: {
          flowGeneration: true,
        },
      },
    } satisfies ToMethodModelingMessage);
    expect(postMessage).toHaveBeenNthCalledWith(2, {
      t: "setInModelingMode",
      inModelingMode: true,
    });
    expect(postMessage).toHaveBeenNthCalledWith(3, {
      t: "setMethodModelingPanelViewState",
      viewState: {
        language: QueryLanguage.Java,
        modelConfig: {
          flowGeneration: true,
        },
      },
    } satisfies ToMethodModelingMessage);
  });

  it("should load webview when active DB and a selected method", async () => {
    const dbModelingState = mockedObject<DbModelingState>({
      databaseItem: mockDatabaseItem({
        language: "java",
      }),
    });
    getStateForActiveDb.mockReturnValue(dbModelingState);

    const selectedMethodDetails: SelectedMethodDetails = {
      databaseItem: dbModelingState.databaseItem,
      method: createMethod(),
      usage: createUsage(),
      modeledMethods: [],
      isModified: false,
    };
    getSelectedMethodDetails.mockReturnValue(selectedMethodDetails);

    await onDidReceiveMessage({
      t: "viewLoaded",
      viewName: MethodModelingViewProvider.viewType,
    });

    expect(postMessage).toHaveBeenCalledTimes(4);
    expect(postMessage).toHaveBeenNthCalledWith(1, {
      t: "setMethodModelingPanelViewState",
      viewState: {
        language: undefined,
        modelConfig: {
          flowGeneration: true,
        },
      },
    } satisfies ToMethodModelingMessage);
    expect(postMessage).toHaveBeenNthCalledWith(2, {
      t: "setInModelingMode",
      inModelingMode: true,
    });
    expect(postMessage).toHaveBeenNthCalledWith(3, {
      t: "setMethodModelingPanelViewState",
      viewState: {
        language: QueryLanguage.Java,
        modelConfig: {
          flowGeneration: true,
        },
      },
    } satisfies ToMethodModelingMessage);
    expect(postMessage).toHaveBeenNthCalledWith(4, {
      t: "setSelectedMethod",
      method: selectedMethodDetails.method,
      modeledMethods: selectedMethodDetails.modeledMethods,
      isModified: selectedMethodDetails.isModified,
    });
  });
});
