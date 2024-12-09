## VS Code CodeQL E2E Tests

When running the tests locally on a mac a different processor has to be emulated, which makes everythign VERY slow. Therefore we need to add higher timeouts in the test, so that they pass locally.

### How to use locally

Setup

- install playwright if you haven't yet (`npx playwright install`)
- go to the e2e test folder on your terminal
- make sure docker is running
- run `docker compose build`
- run `docker compose up`

Run tests

- run `npx playwright test --ui` from the e2e test folder to follow the test while it's running. This UI has a 'locator' tool with which elements on the test screen can be found
- use `npx playwright test --debug` to follow the test in real time and interact with the interface, e.g. press enter or input into fields, stop and start

During the test elements are created in the docker volume, e.g. the downloaded database or query data. This might interfer with other tests or when running a test twice. If that happens restart your docker volume by using `docker-compose down -v` and `docker-compose up`. Sometimes already existing queries from former runs change the input the extension needs.
