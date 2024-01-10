## VS Code CodeQL E2E Tests

When running the tests locally on a mac a different processor has to be emulated, which makes everythign VERY slow. Hence many timeouts in the test.

### How to use locally

Setup

- run `docker-compose build` from the e2e test folder `vscode-codeql/extensions/ql-vscode/test/e2e`
- run `docker-compose up` from the e2e test folder `vscode-codeql/extensions/ql-vscode/test/e2e`

Run tests

- run  `npx playwright test --ui` from the vscode-codeql folder `vscode-codeql/extensions/ql-vscode` to follow the test while it's running. This UI has a 'locator' tool with which elements on the test screen can be 
- use `npx playwright test --debug` to follow the test in real time and interact with the interface, e.g. press enter or input into fields, stop and start

If you get failures after the first test run you can try to remove the volume data, e.g. by running `docker-compose down -v`. Sometimes already existing queries from former runs change the input the extension needs.
