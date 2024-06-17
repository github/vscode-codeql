# CodeQL extension for Visual Studio Code

This project is an extension for Visual Studio Code that adds rich language support for [CodeQL](https://codeql.github.com/docs/) and allows you to easily find problems in codebases. In particular, the extension:

- Enables you to use CodeQL to query databases generated from source code.
- Shows the flow of data through the results of path queries, which is essential for triaging security results.
- Provides an easy way to run queries from the large, open source repository of [CodeQL security queries](https://github.com/github/codeql).
- Adds IntelliSense to support you writing and editing your own CodeQL query and library files.

To see what has changed in the last few versions of the extension, see the [Changelog](https://github.com/github/vscode-codeql/blob/main/extensions/ql-vscode/CHANGELOG.md).

You can also read full documentation for the extension on the [GitHub documentation website](https://docs.github.com/code-security/codeql-for-vs-code/using-the-advanced-functionality-of-the-codeql-for-vs-code-extension).

## Quick start overview

The information in this `README` file describes the quickest way to start using CodeQL.
For information about other configurations, see "[Using the advanced functionality of the CodeQL for VS Code extension](https://docs.github.com/code-security/codeql-for-vs-code/using-the-advanced-functionality-of-the-codeql-for-vs-code-extension)" in the GitHub documentation.

### Quick start: Installing and configuring the extension

1. [Install the extension](#installing-the-extension).  
1. [Check access to the CodeQL CLI](#checking-access-to-the-codeql-cli).
1. [Clone the CodeQL starter workspace](#cloning-the-codeql-starter-workspace).

### Quick start: Using CodeQL

1. [Import a database from GitHub](#importing-a-database-from-github).
1. [Run a query](#running-a-query).

---
<!-- markdownlint-disable-next-line MD024 -->
## Quick start: Installing and configuring the extension

### Installing the extension

The CodeQL extension requires a minimum of Visual Studio Code 1.39. Older versions are not supported.

1. Install and open Visual Studio Code.
1. Open the Extensions view (press **Ctrl+Shift+X** or **Cmd+Shift+X**).
1. At the top of the Extensions view, type `CodeQL` in the box labeled **Search Extensions in Marketplace**.
1. Locate the CodeQL extension and select **Install**. This will install the extension from the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=github.vscode-codeql).

### Checking access to the CodeQL CLI

The extension uses the [CodeQL CLI](https://codeql.github.com/docs/codeql-cli/) to compile and run queries. The extension automatically manages access to the CLI for you by default (recommended). To check for updates to the CodeQL CLI, you can use the **CodeQL: Check for CLI Updates** command.

If you want to override the default behavior and use a CodeQL CLI that's already on your machine, see "[Configuring access to the CodeQL CLI](https://docs.github.com/code-security/codeql-for-vs-code/using-the-advanced-functionality-of-the-codeql-for-vs-code-extension/configuring-access-to-the-codeql-cli)" in the GitHub documentation.

If you have any difficulty with CodeQL CLI access, see the **CodeQL Extension Log** in the **Output** view for any error messages.

### Cloning the CodeQL starter workspace

When you're working with CodeQL, you need access to the standard CodeQL libraries and queries.
Initially, we recommend that you clone and use the ready-to-use [starter workspace](https://github.com/github/vscode-codeql-starter/).
This includes libraries and queries for the main supported languages, with folders set up ready for your custom queries. After cloning the workspace (use `git clone --recursive`), you can use it in the same way as any other VS Code workspace—with the added advantage that you can easily update the CodeQL libraries.

For information about configuring an existing workspace for CodeQL, see "[Setting up a CodeQL workspace](https://docs.github.com/code-security/codeql-for-vs-code/using-the-advanced-functionality-of-the-codeql-for-vs-code-extension/setting-up-a-codeql-workspace#option-2-updating-an-existing-workspace-for-codeql-advanced)" in the GitHub documentation.

## Upgrading CodeQL standard libraries

You can easily keep up-to-date with the latest changes to the [CodeQL standard libraries](https://github.com/github/codeql).

If you're using the [CodeQL starter workspace](https://github.com/github/vscode-codeql-starter/), you can pull in the latest standard libraries by running:

```shell
git pull
git submodule update --recursive
```

in the starter workspace directory.

If you're using your own clone of the CodeQL standard libraries, you can do a `git pull` from where you have the libraries checked out.

<!-- markdownlint-disable-next-line MD024 -->
## Quick start: Using CodeQL

You can find all the commands contributed by the extension in the Command Palette (**Ctrl+Shift+P** or **Cmd+Shift+P**) by typing `CodeQL`, many of them are also accessible through the interface, and via keyboard shortcuts.

### Importing a database from GitHub

While you can use the [CodeQL CLI to create your own databases](https://codeql.github.com/docs/codeql-cli/creating-codeql-databases/), the simplest way to start is by downloading a database from GitHub.com.

1. Find a project that you're interested in on GitHub.com, for example [Apache Kafka](https://github.com/apache/kafka).
1. Copy the link to that project, for example `https://github.com/apache/kafka`.
1. In VS Code, open the Command Palette and choose the **CodeQL: Download Database from GitHub** command.
1. Paste the link you copied earlier.
1. Select the language for the database you want to download (only required if the project has databases for multiple languages).
1. Once the CodeQL database has been imported, it is displayed in the Databases view.

For more information, see "[Managing CodeQL databases](https://docs.github.com/code-security/codeql-for-vs-code/getting-started-with-codeql-for-vs-code/managing-codeql-databases#choosing-a-database-to-analyze)" in the GitHub documentation.

### Running a query

The instructions below assume that you're using the CodeQL starter workspace, or that you've added the CodeQL libraries and queries repository to your workspace.

1. Expand the `ql` folder and locate a query to run. The standard queries are grouped by target language and then type, for example: `ql/java/ql/src/Likely Bugs`.
1. Open a query (`.ql`) file.
1. Right-click in the query window and select **CodeQL: Run Query on Selected Database**. Alternatively, open the Command Palette (**Ctrl+Shift+P** or **Cmd+Shift+P**), type `Run Query`, then select **CodeQL: Run Query on Selected Database**.

The CodeQL extension runs the query on the current database using the CLI and reports progress in the bottom right corner of the application.
When the results are ready, they're displayed in the CodeQL Query Results view. Use the dropdown menu to choose between different forms of result output.

If there are any problems running a query, a notification is displayed in the bottom right corner of the application. In addition to the error message, the notification includes details of how to fix the problem.

### Keyboard navigation

If you wish to navigate the query results from your keyboard, you can bind shortcuts to the **CodeQL: Navigate Up/Down/Left/Right in Result Viewer** commands.

## What next?

We recommend reading the [full documentation for the extension](https://docs.github.com/code-security/codeql-for-vs-code/) on the GitHub documentation website. You may also find the following resources useful:

- [Create a database for a different codebase](https://codeql.github.com/docs/codeql-cli/creating-codeql-databases/).
- [Try out variant analysis](https://docs.github.com/code-security/codeql-for-vs-code/getting-started-with-codeql-for-vs-code/running-codeql-queries-at-scale-with-multi-repository-variant-analysis).
- [Learn more about CodeQL](https://codeql.github.com/docs/).
- [Read how security researchers use CodeQL to find CVEs](https://github.blog/tag/github-security-lab/).

## License

The CodeQL extension for Visual Studio Code is [licensed](LICENSE.md) under the MIT License. The version of CodeQL used by the CodeQL extension is subject to the [GitHub CodeQL Terms & Conditions](https://securitylab.github.com/tools/codeql/license).

## Data and Telemetry

If you specifically opt-in to permit GitHub to do so, GitHub will collect usage data and metrics for the purposes of helping the core developers to improve the CodeQL extension for VS Code. This data will not be shared with any parties outside of GitHub. IP addresses and installation IDs will be retained for a maximum of 30 days. Anonymous data will be retained for a maximum of 180 days. For more information, see "[Telemetry in CodeQL for Visual Studio Code](https://docs.github.com/code-security/codeql-for-vs-code/using-the-advanced-functionality-of-the-codeql-for-vs-code-extension/telemetry-in-codeql-for-visual-studio-code)" in the GitHub documentation.
