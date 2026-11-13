# Custom variant analysis server (internal)

> [!WARNING]
> **Internal and unsupported.** This is not a public feature. The settings below are not declared in
> `package.json`, do not appear in the Settings UI, and may change or be removed without notice.
> Do not document them in user-facing docs or the changelog.

By default, multi-repository variant analysis (MRVA) uses the GitHub REST API and the user's GitHub sign-in.
An organization can instead send variant analyses to its own server. That server must implement the
GitHub variant analysis REST endpoints and authenticate requests with a bearer token. A separate
extension, owned by the organization, supplies the token.

## Settings

Both settings are only read from **local or remote user** settings. Workspace and folder values are ignored,
so a repository cannot redirect queries or tokens.
`inspect().globalValue` is VS Code's merged user value, including remote user settings;
the remote value takes precedence over the local value. These are not OS-wide policy settings.
Administrators can provision the remote user settings file directly. A companion extension writing
with `ConfigurationTarget.Global` should not assume that the write always targets the remote file:
VS Code's choice depends on the setting's scope and whether a remote value already exists.

| Setting | Value |
| --- | --- |
| `codeQL.variantAnalysis.serverUrl` | Base URL of the server. Must be `https:` and must not contain credentials. A trailing `/` is removed. |
| `codeQL.variantAnalysis.serverTokenProvider` | ID (`publisher.name`) of the installed extension that provides the token. |

If `serverUrl` is set but invalid, variant analysis fails instead of falling back to GitHub.
Query strings and fragments are rejected; base path prefixes are supported.
The hidden server setting is the opt-in switch; there is no additional canary gate.

## Token provider extension

The extension named in `serverTokenProvider` must return the following from `activate()`:

```ts
export interface VariantAnalysisServerTokenProvider {
  getVariantAnalysisServerToken(serverUrl: string): Promise<string | undefined>;
  openVariantAnalysisLogs?(serverUrl: string, analysisId: number): Promise<void>;
}
```

CodeQL activates the extension if it isn't already running, and calls `getVariantAnalysisServerToken`
before every request. The provider is responsible for caching and refreshing the token. It should return
`undefined` if no token is available, so that CodeQL can show a clear error instead of sending an
unauthenticated request. The token is never logged.
CodeQL waits at most 30 seconds for activation and token acquisition combined. On timeout, no API
request is sent; the provider's own work is not forcibly stopped. Finish sign-in in the provider and retry.
HTTP 401/403 errors identify the provider and ask the user to re-authenticate; there is no automatic retry
or token-refresh argument.

Only the extension that the user or administrator names is called. Extensions cannot register
themselves as providers.

The optional `openVariantAnalysisLogs` hook enables **View logs** in history and result views.
The provider owns log retrieval, authentication, and presentation (for example, opening a browser
or an output channel). CodeQL passes the originating server URL and analysis/session ID, not an
Actions workflow ID. Without the hook the action is hidden. Capability discovery activates the
provider in the background with the same 30-second activation bound. History and result views render
immediately without the action, then refresh when discovery finishes. Discovery is shared and cached
per server URL and provider ID, including failures; changing either setting clears the cache.
If discovery fails, CodeQL logs the error and leaves the action hidden without delaying saved results.
Opening logs does not request a token from CodeQL.
The hook should resolve once its viewer is opened and reject on failure. Runs from another configured
server cannot invoke it. No log endpoint or GitHub Actions compatibility is required.

Providers should publish their exports immediately from `activate()`. Catalog downloads, sign-in
prompts, and other potentially unbounded work must not block activation; perform them lazily in the
operation that needs them.

## Behavior when a server is configured

- MRVA is enabled regardless of `github-enterprise.uri`. The GitHub sign-in, GitHub database
  downloads and other extensions that read `github-enterprise.uri` are not affected.
- No controller repository is needed. Requests use controller repository ID `0`.
- Runs retain their originating server URL. Polling, task retrieval and cancellation fail if
  the current server setting differs. Restore the original setting to resume them. Legacy runs
  without a server URL are treated as GitHub runs.
- The GitHub token is never sent to the server, and results are never uploaded to GitHub:
  "Export to gist" is unavailable; "View logs" uses the companion's optional hook, not GitHub Actions.
- Removing a running server analysis from history offers to cancel it through the server.
  Dismissing that offer removes only the local history entry; the server run continues.
- Result artifacts are downloaded from `artifact_url` without authentication, as on GitHub.
- If a repository task has no `database_commit_sha`, file links point to `HEAD`.
  These links may not match the analyzed revision.
- Custom-server file links use `repository.html_url` from the task or analysis response.
  If it is absent or not an HTTP(S) URL, results still display, but file locations are plain text.
  GitHub run links retain their existing host fallback.
- GitHub's built-in repository lists and the repository tree's "Open on GitHub" action are hidden
  while a custom server is configured.
- The canary-only autofix action still downloads repository source through GitHub sign-in.
  It requires the analyzed repository and revision to be available on the configured GitHub host.
  Custom source retrieval is not supported.

## Server contract

All paths are relative to `serverUrl`. Requests send `Authorization: Bearer <token>` and JSON bodies.
Redirects are rejected rather than forwarding query packs to another endpoint.
Request and response shapes match `src/variant-analysis/gh-api/variant-analysis.ts`.

| Operation | Request |
| --- | --- |
| Submit | `POST /repositories/0/code-scanning/codeql/variant-analyses` |
| Get status | `GET /repositories/0/code-scanning/codeql/variant-analyses/{id}` |
| Get repository task | `GET /repositories/0/code-scanning/codeql/variant-analyses/{id}/repositories/{repoId}` |
| Cancel | `POST /repositories/0/code-scanning/codeql/variant-analyses/{id}/cancel` |

Variant analysis responses must include `controller_repo`; subsequent requests use its `id` as the
repository path parameter (normally `0`). The analysis `id` is the server's run/session identifier.
Custom-server cancellation does not require `actions_workflow_run_id`; GitHub cancellation still uses
the GitHub Actions route and requires that field. Errors should be returned as non-2xx responses with a JSON body
`{ "message": "..." }`. CodeQL shows the status and that message to the user.

## Running CodeQL in a remote workspace

CodeQL declares a Node `main` entry point, so VS Code normally classifies it as a workspace extension
without an explicit `extensionKind`. Install both CodeQL and its token provider in the same remote
extension host. No override should normally be necessary.

If a deployment has overridden the placement, inspect `remote.extensionKind` and the editor's
product overrides. The user setting `{ "github.vscode-codeql": ["workspace"] }` under
`remote.extensionKind` can override placement, but should not be installed as a blanket workaround.

VS Code implementation references:
[configuration inspection](https://github.com/microsoft/vscode/blob/main/src/vs/workbench/api/common/extHostConfiguration.ts),
[local/remote user configuration merging](https://github.com/microsoft/vscode/blob/main/src/vs/platform/configuration/common/configurationModels.ts),
and [extension kind inference](https://github.com/microsoft/vscode/blob/main/src/vs/workbench/services/extensions/common/extensionManifestPropertiesService.ts).
