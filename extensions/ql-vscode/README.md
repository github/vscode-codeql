# CodeQL extension for Visual Studio Code

This project is an extension for Visual Studio Code that adds rich language support for [CodeQL](https://help.semmle.com/codeql). It's used to find problems in codebases using CodeQL. In particular, the extension:

* Enables you to use CodeQL to query databases and discover problems in codebases.
* Shows the flow of data through the results of path queries, which is essential for triaging security results.
* Provides an easy way to run queries from the large, open source repository of [CodeQL security queries](https://github.com/Semmle/ql).
* Adds IntelliSense to support you writing and editing your own CodeQL query and library files.

## Quick start overview

The information in this `README` file describes the quickest way to start using CodeQL.
For information about other configurations, see the separate [CodeQL help](https://help.semmle.com/codeql/codeql-for-vscode.html).

**Quick start: Installing and configuring the extension**

1. [Install the extension](#installing-the-extension).
1. Beta release only: [Configure access to the CodeQL CLI](#configuring-access-to-the-codeql-cli).
1. [Clone the CodeQL starter workspace](#cloning-the-codeql-starter-workspace).

**Quick start: Using CodeQL**

1. [Import a database from LGTM.com](#importing-a-database-from-lgtm.com).
1. [Run a query](#running-a-query).

-----

## Quick start: Installing and configuring the extension

### Installing the extension

The CodeQL extension requires a minimum of Visual Studio Code 1.39. Older versions are not supported.

1. Install and open Visual Studio Code.
1. Download the CodeQL extension: https://github.com/github/vscode-codeql/releases.
1. Open the Extensions view (press **Ctrl+Shift+X** or **Cmd+Shift+X**).
1. At the top right of the Extensions view, select **More Actions** > **Install from VSIX**.
1. Locate the `vscode-codeql` installer, and select **Install**.

In the future, you'll be able to install the extension directly from the Marketplace.

> **Note for internal testers**: If you installed a pre-beta version of the extension, you will need to uninstall it from the Extensions view before using the beta release (or newer). If you've set up a workspace containing CodeQL databases with an older version, you will also need to create a fresh workspace with the same folders, or delete and re-add each database.

### Configuring access to the CodeQL CLI

The extension uses the [CodeQL CLI](https://help.semmle.com/codeql/codeql-cli.html) to compile and run queries. The extension can automatically manage access to the CLI for you (recommended), or you can use settings to specify a different version of the CLI.

<font color="red">TODO: Remove the remainder of this section before public release and replace with a link to more information in the CodeQL documentation.</font>

When the extension is publicly released, you will only need to specify the location of the CodeQL CLI if you want to override the default version of the CLI.
Until then, you need to add the following configuration to your VS Code user or workspace settings.

```json
"codeQL.distribution.includePrerelease": true,
"codeQL.distribution.personalAccessToken": "SUBSTITUTE THIS WITH YOUR PERSONAL ACCESS TOKEN",
```

The extension needs a personal access token to authenticate with the [private binaries repository](https://github.com/github/codeql-cli-binaries). The token must be assigned the [`repo`](https://developer.github.com/apps/building-oauth-apps/understanding-scopes-for-oauth-apps/) scope to have access to the releases of this repository. For details of how to obtain a personal access token, see [Creating a personal access token for the command line](https://help.github.com/en/github/authenticating-to-github/creating-a-personal-access-token-for-the-command-line) and [Authorizing a personal access token for use with SAML single sign-on](https://help.github.com/en/github/authenticating-to-github/authorizing-a-personal-access-token-for-use-with-saml-single-sign-on).

To check for updates to the distribution, you can use the **CodeQL: Check for Updates to Command-Line Tools** command.

If you have any difficulty setting up CodeQL CLI access, see the **CodeQL Extension Log** in the **Output** view for any error messages.

For information about configuring the extension to use other versions of the CodeQL CLI, see [Notes for Semmle internal users](#notes-for-semmle-internal-users) below.

### Cloning the CodeQL starter workspace

When you're working with CodeQL, you need access to the standard CodeQL libraries and queries.
Initially, we recommend that you clone and use the ready-to-use starter workspace, https://github.com/github/vscode-codeql-starter/.
This includes libraries and queries for the main supported languages, with folders set up ready for your custom queries. After cloning the workspace (use `git clone --recursive`), you can use it in the same way as any other VS Code workspace—with the added advantage that you can easily update the CodeQL libraries.

For information about how to add further languages, or to configure an existing workspace for CodeQL, see [TODO](https://help.semmle.com/codeql/codeql-for-vscode.html)

## Quick start: Using CodeQL

You can find all the commands contributed by the extension in the Command Palette (**Ctrl+Shift+P** or **Cmd+Shift+P**) by typing `CodeQL`, many of them are also accessible through the interface, and via keyboard shortcuts.

### Importing a database from LGTM.com

While you can use the [CodeQL CLI to create your own databases](https://help.semmle.com/codeql/codeql-cli/procedures/create-codeql-database.html), the simplest way to start is by downloading a database from LGTM.com.

1. Log in to LGTM.com.
1. Find a project you're interested in and display the **Integrations** tab (for example, [Apache Kafka](https://lgtm.com/projects/g/apache/kafka/ci/)).
1. Scroll to the **CodeQL databases for local analysis** section at the bottom of the page.
1. Download databases for the languages that you want to explore.
1. Unzip the databases.
1. For each database that you want to import:
    1. In the VS Code sidebar, go to **CodeQL** > **Databases** and click **+**.
    1. Browse to the unzipped database folder (the parent folder that contains `db-<language>` and `src`) and select **Choose database** to add it.

When the import is complete, each CodeQL database is displayed in the CodeQL sidebar under **Databases**.

### Running a query

The instructions below assume that you're using the CodeQL starter workspace, or that you've added the CodeQL libraries and queries repository to your workspace.

1. Expand the `ql` folder and locate a query to run. The standard queries are grouped by target language and then type, for example: `ql/java/ql/src/Likely Bugs`.
1. Open a query (`.ql`) file.
3. Right-click in the query window and select **CodeQL: Run Query**. Alternatively, open the Command Palette (**Ctrl+Shift+P** or **Cmd+Shift+P**), type `Run Query`, then select **CodeQL: Run Query**.

The CodeQL extension runs the query on the current database using the CLI and reports progress in the bottom right corner of the application.
When the results are ready, they're displayed in the CodeQL Query Results view. Use the dropdown menu to choose between different forms of result output.

If there are any problems running a query, a notification is displayed in the bottom right corner of the application. In addition to the error message, the notification includes details of how to fix the problem.

## What next?

For more information about the CodeQL extension, see [CodeQL for Visual Studio Code](https://help.semmle.com/codeql/codeql-for-vscode.html). Otherwise, you could:

* [Create a database for a different codebase](https://help.semmle.com/codeql/codeql-cli/procedures/create-codeql-database.html).
* [Try out variant analysis](https://help.semmle.com/QL/learn-ql/ql-training.html).
* [Learn more about CodeQL](https://help.semmle.com/QL/learn-ql/).
* [Read how security researchers use CodeQL to find CVEs](https://blog.semmle.com/tags/cve/).


---

<font color="red">TODO: Remove the section below before public release.</font>

## Notes for Semmle internal users

### Using a `codeql` binary on your PATH

If you already have a `codeql` binary on your PATH, the extension will use this binary.

### Manually specify which version of the CodeQL CLI to use

Options for obtaining a version of the CodeQL CLI:
- Download from the [private binaries repository](https://github.com/github/codeql-cli-binaries/releases).
- Download from [Semmle-internal Jenkins](https://jenkins.internal.semmle.com/job/CodeQL-CLI/):
  1. Open the last successful artifacts and download `codeql-all.zip`.
  1. After extracting the archive, the CodeQL binary path will be `<extractionRoot>/codeql/codeql` where _`<extractionRoot>`_ is the folder where you extracted the zip.
- Build your own version of the CodeQL CLI from the `Semmle/code` repository by running `./build target/intree/codeql`. The CodeQL binary path will be `codeRoot/target/intree/codeql/codeql` (or `codeql.cmd` on Windows), where `codeRoot` is the root of your `Semmle/code` checkout.

Once you have a binary on your machine, edit the setting `codeQL.distribution.executablePath` to point to it.
This can be set per-workspace, or you can set it in your global user settings to apply to all workspaces you open.


