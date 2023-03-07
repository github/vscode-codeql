# Releasing (write access required)

1. Go through [our test plan](/extensions/ql-vscode/docs/test-plan.md) to ensure that the extension is working as expected.
1. Double-check the `CHANGELOG.md` contains all desired change comments and has the version to be released with date at the top.
    * Go through all recent PRs and make sure they are properly accounted for.
    * Make sure all changelog entries have links back to their PR(s) if appropriate.
    * For picking the new version number, we default to increasing the patch version number, but make our own judgement about whether a change is big enough to warrant a minor version bump. Common reasons for a minor bump could include:
      * Making substantial new features available to all users. This can include lifting a feature flag.
      * Breakage in compatibility with recent versions of the CLI.
      * Minimum required version of VS Code is increased.
      * New telemetry events are added.
      * Deprecation or removal of commands.
      * Accumulation of many changes, none of which are individually big enough to warrant a minor bump, but which together are. This does not include changes which are purely internal to the extension, such as refactoring, or which are only available behind a feature flag.
1. Double-check that the node version we're using matches the one used for VS Code. If it doesn't, you will then need to update the node version in the following files:
    * `.nvmrc` - this will enable `nvm` to automatically switch to the correct node version when you're in the project folder
    * `.github/workflows/main.yml` - all the "node-version: <version>" settings
    * `.github/workflows/release.yml` - the "node-version: <version>" setting
1. Double-check that the extension `package.json` and `package-lock.json` have the version you intend to release. If you are doing a patch release (as opposed to minor or major version) this should already be correct.
1. Create a PR for this release:
    * This PR will contain any missing bits from steps 1 and 2. Most of the time, this will just be updating `CHANGELOG.md` with today's date.
    * Create a new branch for the release named after the new version. For example: `v1.3.6`
    * Create a new commit with a message the same as the branch name.
    * Create a PR for this branch.
    * Wait for the PR to be merged into `main`
1. Switch to `main` and add a new tag on the `main` branch with your new version (named after the release), e.g.
    ```bash
    git checkout main
    git tag v1.3.6
    ```

   If you've accidentally created a badly named tag, you can delete it via
    ```bash
    git tag -d badly-named-tag
    ```
1. Push the new tag up:

   a. If you're using a fork of the repo:

    ```bash
    git push upstream refs/tags/v1.3.6
    ```

   b. If you're working straight in this repo:

    ```bash
    git push origin refs/tags/v1.3.6
    ```

   This will trigger [a release build](https://github.com/github/vscode-codeql/releases) on Actions.

    * **IMPORTANT** Make sure you are on the `main` branch and your local checkout is fully updated when you add the tag.
    * If you accidentally add the tag to the wrong ref, you can just force push it to the right one later.
1. Monitor the status of the release build in the `Release` workflow in the Actions tab.
    * DO NOT approve the "publish" stages of the workflow yet.
1. Download the VSIX from the draft GitHub release at the top of [the releases page](https://github.com/github/vscode-codeql/releases) that is created when the release build finishes.
1. Unzip the `.vsix` and inspect its `package.json` to make sure the version is what you expect,
   or look at the source if there's any doubt the right code is being shipped.
1. Install the `.vsix` file into your vscode IDE and ensure the extension can load properly. Run a single command (like run query, or add database).
1. Go to the actions tab of the vscode-codeql repository and select the [Release workflow](https://github.com/github/vscode-codeql/actions?query=workflow%3ARelease).
    - If there is an authentication failure when publishing, be sure to check that the authentication keys haven't expired. See below.
1. Approve the deployments of the correct Release workflow. This will automatically publish to Open VSX and VS Code Marketplace.
1. Go to the draft GitHub release in [the releases tab of the repository](https://github.com/github/vscode-codeql/releases), click 'Edit', add some summary description, and publish it.
1. Confirm the new release is marked as the latest release at <https://github.com/github/vscode-codeql/releases>.
1. If documentation changes need to be published, notify documentation team that release has been made.
1. Review and merge the version bump PR that is automatically created by Actions.

## Secrets and authentication for publishing

Repository administrators, will need to manage the authentication keys for publishing to the VS Code marketplace and Open VSX. Each requires an authentication token. The VS Code marketplace token expires yearly.

To regenerate the Open VSX token:

1. Log in to the [user settings page on Open VSX](https://open-vsx.org/user-settings/namespaces).
1. Make sure you are a member of the GitHub namespace.
1. Go to the [Access Tokens](https://open-vsx.org/user-settings/tokens) page and generate a new token.
1. Update the secret in the `publish-open-vsx` environment in the project settings.

To regenerate the VSCode Marketplace token, please see our internal documentation. Note that Azure DevOps PATs expire every 90 days and must be regenerated.