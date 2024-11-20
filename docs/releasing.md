# Releasing (write access required)

1. Make sure the needed authentication keys are valid. Most likely the Azure DevOps PAT needs to be regenerated. See below.
1. Determine the new version number. We default to increasing the patch version number, but make our own judgement about whether a change is big enough to warrant a minor version bump. Common reasons for a minor bump could include:
    - Making substantial new features available to all users. This can include lifting a feature flag.
    - Breakage in compatibility with recent versions of the CLI.
    - Minimum required version of VS Code is increased.
    - New telemetry events are added.
    - Deprecation or removal of commands.
    - Accumulation of many changes, none of which are individually big enough to warrant a minor bump, but which together are. This does not include changes which are purely internal to the extension, such as refactoring, or which are only available behind a feature flag.
1. Create a release branch named after the new version (e.g. `v1.3.6`):
    - For a regular scheduled release this branch will be based on latest `main`.
        - Make sure your local copy of `main` is up to date so you are including all changes.
    - To do a minimal bug-fix release, base the release branch on the tag from the most recent release and then add only the changes you want to release.
        - Choose this option if you want to release a specific set of changes (e.g. a bug fix) and don't want to incur extra risk by including other changes that have been merged to the `main` branch.

        ```bash
        git checkout -b <new_release_branch> <previous_release_tag>
        ```

1. Run the ["Run CLI tests" workflow](https://github.com/github/vscode-codeql/actions/workflows/cli-test.yml) and make sure the tests are green.
    - You can skip this step if you are releasing from `main` and there were no merges since the most recent daily scheduled run of this workflow.
1. Double-check the `CHANGELOG.md` contains all desired change comments and has the version to be released with date at the top.
    - Go through PRs that have been merged since the previous release and make sure they are properly accounted for.
    - Make sure all changelog entries have links back to their PR(s) if appropriate.
1. Double-check that the extension `package.json` and `package-lock.json` have the version you intend to release. If you are doing a patch release (as opposed to minor or major version) this should already be correct.
1. Commit any changes made during steps 4 and 5 with a commit message the same as the branch name (e.g. `v1.3.6`).
1. Open a PR for this release.
    - The PR diff should contain:
        - Any missing bits from steps 4 and 5. Most of the time, this will just be updating `CHANGELOG.md` with today's date.
        - If releasing from a branch other than `main`, this PR will also contain the extension changes being released.
1. Build the extension using `npm run build` and install it on your VS Code using "Install from VSIX".
1. Go through [our test plan](./test-plan.md) to ensure that the extension is working as expected.
1. Create a new tag on the release branch with your new version (named after the release), e.g.

    ```bash
    git tag v1.3.6
    ```

1. Merge the release PR into `main`.
    - If there are conflicts in the changelog, make sure to place any new changelog entries at the top, above the section for the current release, as these new entries are not part of the current release and should be placed in the "unreleased" section.
    - The release PR must be merged before pushing the tag to ensure that we always release a commit that is present on the `main` branch. It's not required that the commit is the head of the `main` branch, but there should be no chance of a future release accidentally not including changes from this release.
1. Push the new tag up:

    ```bash
    git push origin refs/tags/v1.3.6
    ```

1. Find the [Release](https://github.com/github/vscode-codeql/actions?query=workflow%3ARelease) workflow run that was just triggered by pushing the tag, and monitor the status of the release build.
    - DO NOT approve the "publish" stages of the workflow yet.
1. Download the VSIX from the draft GitHub release at the top of [the releases page](https://github.com/github/vscode-codeql/releases) that is created when the release build finishes.
1. Unzip the `.vsix` and inspect its `package.json` to make sure the version is what you expect,
   or look at the source if there's any doubt the right code is being shipped.
1. Install the `.vsix` file into your vscode IDE and ensure the extension can load properly. Run a single command (like run query, or add database).
1. Approve the deployments of the [Release](https://github.com/github/vscode-codeql/actions?query=workflow%3ARelease) workflow run. This will automatically publish to Open VSX and VS Code Marketplace.
    - If there is an authentication failure when publishing, be sure to check that the authentication keys haven't expired. See below.
1. Go to the draft GitHub release in [the releases page](https://github.com/github/vscode-codeql/releases), click 'Edit', add some summary description, and publish it.
1. Confirm the new release is marked as the latest release.
1. If documentation changes need to be published, notify documentation team that release has been made.
1. Review and merge the version bump PR that is automatically created by the Release workflow.

## Secrets and authentication for publishing

Repository administrators, will need to manage the authentication keys for publishing to the VS Code marketplace and Open VSX. Each requires an authentication token.

To regenerate the Open VSX token:

1. Log in to the [user settings page on Open VSX](https://open-vsx.org/user-settings/namespaces).
1. Make sure you are a member of the GitHub namespace.
1. Go to the [Access Tokens](https://open-vsx.org/user-settings/tokens) page and generate a new token.
1. Update the secret in the `publish-open-vsx` environment in the project settings.

Publishing to the VS Code Marketplace is done using a user-assigned managed identity and should not require the token to be manually updated.
