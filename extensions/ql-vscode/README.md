CodeQL Extension for Visual Studio Code
===

Configuration
---

To edit the configuration settings, right-click **QL** in the Extensions container in the sidebar and select `Configure Extension Settings`.
You can also access these settings from the Command Palette (`Ctrl+Shift+P`): choose `Preferences: Open User Settings` or `Preferences: Open Workspace Settings` and search for `QL`, or choose `Preferences: Open Settings (JSON)` and edit the settings file manually.

### Getting a CodeQL distribution

The extension requires a distribution of the CodeQL CLI tools. You can have the extension automatically manage this for you (recommended), or manually specify where to find the CodeQL CLI.

#### Recommended: Using an extension-managed distribution

We envision many end-users electing to have the extension manage its distribution of CodeQL.
When the extension is publicly released, this will require no configuration.
Until then, you will need to add the following configuration to your VS Code user or workspace settings.

```json
"ql.distribution.includePrerelease": true,
"ql.distribution.personalAccessToken": "SUBSTITUTE THIS WITH YOUR PERSONAL ACCESS TOKEN",
"ql.distribution.owner": "github",
"ql.distribution.repository": "codeql-cli-binaries",
```

A personal access token is required to authenticate to the [private binaries repository](https://github.com/github/codeql-cli-binaries). To obtain one, follow the instructions [here](https://help.github.com/en/github/authenticating-to-github/creating-a-personal-access-token-for-the-command-line) and [here](https://help.github.com/en/github/authenticating-to-github/authorizing-a-personal-access-token-for-use-with-saml-single-sign-on). The token must be assigned the [`repo`](https://developer.github.com/apps/building-oauth-apps/understanding-scopes-for-oauth-apps/) scope to have access to the releases of this repository.

The extension will check for updates every day. To check for updates immediately, you can use the "QL: Check for Updates to Command-Line Tools" command.

#### Semmle-internal users: Manually specify which distribution to use

<font color="red">TODO: Remove the references to internal tools in the following sections before public release.</font>

Options for obtaining a CodeQL distribution:
- Download from the [private binaries repository](https://github.com/github/codeql-cli-binaries/releases).
- Download from [Semmle-internal Jenkins](https://jenkins.internal.semmle.com/job/CodeQL-CLI/) (open the last successful artifacts and download `codeql-all.zip`).  Upon extracting the archive, the CodeQL binary path will be `extractionRoot/codeql/codeql` where `extractionRoot` is the folder in which you extracted the zip.
- Build your own from the `Semmle/code` repository by running `./build target/intree/codeql`. The CodeQL binary path will be `codeRoot/target/intree/codeql/codeql`, where `codeRoot` is the root of your `Semmle/code` checkout.

Once you have a binary on your machine, edit the setting `ql.distribution.codeQlPath` to point to it.
This can be set per-workspace, or you can set it in your global user settings to apply to all workspaces you open.

#### Using a `codeql` binary on your PATH

If you already have a `codeql` binary on your path, the extension will use this binary.


### Configuring custom QL projects

Clone https://github.com/github/vscode-codeql-starter/ for a ready-to-use VS Code workspace.

Alternatively, follow the instructions below:
- To make the standard libraries available in your workspace, click File > Add Folder to Workspace, and choose your local checkout of the `Semmle/ql` repository.
- Create new folders (either by New Folder or Add Folder to Workspace) to hold custom queries. Queries for different target languages should be in different folders.
- Each folder of queries in your workspace will need a `qlpack.yml` file that identifies it and tells CodeQL what its dependencies are. (The `master` branch of `Semmle/ql` already has these files.) CodeQL will look for the dependencies in all the open workspace folders, or on the user's search path.
- For example, to make your custom QL folder depend on the CodeQL standard library for C++, create a `qlpack.yml` file with the following contents:
```
name: my-custom-cpp-pack
version: 0.0.0
libraryPathDependencies: codeql-cpp
```


Using the extension
---

You can find all contributed commands in the Command Palette (default `Ctrl+Shift+P`) by typing "QL", but you can also access some of them through the interface.

### Adding a CodeQL database

1. Obtain a database.
   - You can download databases of open-source code from LGTM.com (see the 'Downloading QL snapshots to run queries on' section of [this page](https://lgtm.com/help/lgtm/running-queries-ide)).
   - You can build databases of open-source code on your local machine using the CodeQL CLI.
2. Unzip the database.
2. In the VS Code sidebar, go to `QL > Databases` and click "+".
3. Browse to the unzipped database folder (the parent folder of `db-<language>` and `src`) and add it.

It will now appear in the sidebar under `Databases`. If you have multiple databases, you can select which one to query by clicking `Set Current Database`.

### Running a query

1. Open an existing query from one of your QL projects, or save a new one in the project folder.
2. Make sure that the `.ql` file is in focus.
3. Open the Command Palette (default `Ctrl+Shift+P`) and type "Run Query". Alternatively, right-click and choose "QL: Run Query".

You can see the progress of the query run in the bottom right corner.
Once it has finished, the results are displayed in the QL Query Results view. The dropdown menu will let you choose between different forms of result output.
In the sidebar, under `Query History`, you can see the queries that you have run in the current session.
