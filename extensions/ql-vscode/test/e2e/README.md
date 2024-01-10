## VS Code CodeQL E2E Tests

### Set up

- run `docker-compose build` from the e2e test folder `vscode-codeql/extensions/ql-vscode/test/e2e`
- run `docker-compose up` from the e2e test folder `vscode-codeql/extensions/ql-vscode/test/e2e`
- run  `npx playwright test --ui` from the vscode-codeql folder `vscode-codeql/extensions/ql-vscode`

When you've run the test once! remove the volume data, e.g. by running `docker-compose down -v`