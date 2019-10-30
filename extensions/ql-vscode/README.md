# CodeQL extension for Visual Studio Code

This extension adds rich language support for CodeQL to VS Code.
It's used to find problems in code bases using CodeQL.

## Getting started

1. [Install the extension](#installing-the-extension)
1. [Configure access to a CodeQL distribution](#configuring-a-codeql-distribution)
1. [Configure a CodeQL project](#configuring-codeql-projects)
1. [Add a CodeQL database](#adding-a-codeql-database)
1. [Run a query](#running-a-query)

### Installing the extension

Install and open Visual Studio Code. Press **Ctrl+Shift+X** or **Cmd+Shift+X** to open the Extensions pane. Find and install the CodeQL extension. You can also install the extension from the Marketplace.

> The CodeQL extension requires a minimum of Visual Studio Code 1.39. Older versions are not supported.

## Configuring the extension

To edit the configuration settings, right-click **CodeQL** in the Extensions container in the sidebar and select **Configure Extension Settings**.

You can also access these settings from the Command Palette (**Ctrl+Shift+P** or **Cmd+Shift+P**): choose **Preferences: Open User Settings** or **Preferences: Open Workspace Settings** and search for `CodeQL`, or choose **Preferences: Open Settings (JSON)** and edit the settings file manually.

### Configuring a CodeQL distribution

The extension uses the CodeQL CLI tools to compile and run queries. You can have the extension automatically manage this for you (recommended), or manually specify where to find the CodeQL CLI.

When the extension is publicly released, if you choose to have the extension manage the CLI tools automatically, this will require no configuration.
Until then, you need to add the following configuration to your VS Code user or workspace settings.

```json
"codeQL.distribution.includePrerelease": true,
"codeQL.distribution.personalAccessToken": "SUBSTITUTE THIS WITH YOUR PERSONAL ACCESS TOKEN",
"codeQL.distribution.owner": "github",
"codeQL.distribution.repository": "codeql-cli-binaries",
```

The extension needs a personal access token to authenticate with the [private binaries repository](https://github.com/github/codeql-cli-binaries). The token must be assigned the [`repo`](https://developer.github.com/apps/building-oauth-apps/understanding-scopes-for-oauth-apps/) scope to have access to the releases of this repository. For details of how to obtain a personal access token, see [Creating a personal access token for the command line](https://help.github.com/en/github/authenticating-to-github/creating-a-personal-access-token-for-the-command-line) and [Authorizing a personal access token for use with SAML single sign-on](https://help.github.com/en/github/authenticating-to-github/authorizing-a-personal-access-token-for-use-with-saml-single-sign-on).

The extension will check for updates every day. To check for updates immediately, you can use the **CodeQL: Check for Updates to Command-Line Tools** command.

If you have any difficulty setting up CodeQL CLI access, see the **CodeQL Extension Log** in the **Output** view for any error messages.

> For information about configuring the extension to use other versions of the CodeQL CLI, see [Notes for Semmle internal users](#notes-for-semmle-internal-users) below.

### Configuring CodeQL projects

There are two main options here:

1. Clone https://github.com/github/vscode-codeql-starter/ for a ready-to-use VS Code workspace with libraries and queries for all supported languages.
1. Add each language that you want to include to an existing workspace.

#### Adding standard CodeQL libraries

To make the standard libraries available in your workspace:

1. Select **File** > **Add Folder to Workspace**, and choose your local checkout of the `Semmle/ql` repository.
1. Create one new folder per target language, using either the **New Folder** or **Add Folder to Workspace** options, to hold custom queries.
1. Create a `qlpack.yml` file in each target language folder. This tells CodeQL the target language for that folder and what its dependencies are. (The `master` branch of `Semmle/ql` already has these files.) CodeQL will look for the dependencies in all the open workspace folders, or on the user's search path.

For example, to make a custom CodeQL folder depend on the CodeQL standard library for C++, create a `qlpack.yml` file with the following contents:

```ql
name: my-custom-cpp-pack
version: 0.0.0
libraryPathDependencies: codeql-cpp
```

## Using the extension

You can find all commands contributed by the extension in the Command Palette (**Ctrl+Shift+P** or **Cmd+Shift+P**) by typing `CodeQL`, but you can also access some of them through the interface.

### Adding a CodeQL database

1. Obtain a CodeQL database:
   - You can download databases of open-source code from the **integrations** tab for any project on LGTM.com. 
     Note that LGTM uses the term "QL snapshot" for a CodeQL database. For more information, see the 'Downloading QL snapshots to run queries on' section of [Running queries in your IDE](https://lgtm.com/help/lgtm/running-queries-ide)).
   - You can build databases of open-source code on your local machine using the CodeQL CLI.
2. Unzip the database.
2. In the VS Code sidebar, go to **CodeQL** > **Databases** and click **+**.
3. Browse to the unzipped database folder (the parent folder that contains `db-<language>` and `src` folders) and add it.

It will now appear in the sidebar under **Databases**. If you have multiple databases, you can select which one to query by clicking **Set Current Database**.

### Running a query

1. Open an existing query from one of your CodeQL projects, or save a new one in the project folder.
2. Make sure that the `.ql` file is in focus.
3. Open the Command Palette (**Ctrl+Shift+P** or **Cmd+Shift+P**) and type `Run Query`. Alternatively, right-click and select "CodeQL: Run Query".

You can see the progress of the query run in the bottom right corner.
Once it has finished, the results are displayed in the CodeQL Query Results view. The dropdown menu will let you choose between different forms of result output.
In the sidebar, under `Query History`, you can see the queries that you have run in the current session.

---

<font color="red">TODO: Remove the section below before public release.</font>

## Notes for Semmle internal users

### Manually specify which distribution of the CodeQL CLI to use

Options for obtaining a CodeQL distribution:
- Download from the [private binaries repository](https://github.com/github/codeql-cli-binaries/releases).
- Download from [Semmle-internal Jenkins](https://jenkins.internal.semmle.com/job/CodeQL-CLI/) (open the last successful artifacts and download `codeql-all.zip`).  Upon extracting the archive, the CodeQL binary path will be `extractionRoot/codeql/codeql` where `extractionRoot` is the folder in which you extracted the zip.
- Build your own from the `Semmle/code` repository by running `./build target/intree/codeql`. The CodeQL binary path will be `codeRoot/target/intree/codeql/codeql` (or `codeql.cmd` on Windows), where `codeRoot` is the root of your `Semmle/code` checkout.

Once you have a binary on your machine, edit the setting `codeQL.distribution.executablePath` to point to it.
This can be set per-workspace, or you can set it in your global user settings to apply to all workspaces you open.

### Using a `codeql` binary on your PATH

If you already have a `codeql` binary on your path, the extension will use this binary.
