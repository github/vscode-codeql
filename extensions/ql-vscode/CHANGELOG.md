# CodeQL for Visual Studio Code: Changelog

## [UNRELEASED]

- Add a command _CodeQL: Run Query on Multiple Databases_, which lets users select multiple databases to run a query on. [#898](https://github.com/github/vscode-codeql/pull/898)

## 1.5.2 - 13 July 2021

- Add the _Add Database Source to Workspace_ command to the right-click context menu in the databases view. This lets users re-add a database's source folder to the workspace and browse the source code. [#891](https://github.com/github/vscode-codeql/pull/891)
- Fix markdown rendering in the description of the `codeQL.cli.executablePath` setting. [#908](https://github.com/github/vscode-codeql/pull/908)
- Fix the _Open Query Results_ command in the query history view. [#909](https://github.com/github/vscode-codeql/pull/909)

## 1.5.1 - 23 June 2021

No user facing changes.

## 1.5.0 - 14 June 2021

- Display CodeQL CLI version being downloaded during an upgrade. [#862](https://github.com/github/vscode-codeql/pull/862)
- Display a helpful message and link to documentation when a query produces no results. [#866](https://github.com/github/vscode-codeql/pull/866)
- Refresh test databases automatically after a test run. [#868](https://github.com/github/vscode-codeql/pull/868)
- Allow users to specify a custom directory for storing query server logs (`codeQL.runningQueries.customLogDirectory`). The extension will not delete these logs automatically. [#863](https://github.com/github/vscode-codeql/pull/863)
- Support the VS Code [Workspace Trust feature](https://code.visualstudio.com/docs/editor/workspace-trust). This extension is now enabled in untrusted workspaces, but it restricts commands that contain arbitrary paths. [#861](https://github.com/github/vscode-codeql/pull/861)
- Allow the `codeQL.cli.executablePath` configuration setting to be set in workspace-scoped configuration files. This means that each workspace can now specify its own CodeQL CLI compiler, a feature that is unblocked due to implementing Workspace Trust. [#861](https://github.com/github/vscode-codeql/pull/861)

## 1.4.8 - 05 May 2021

- Copy version information to the clipboard when a user clicks the CodeQL section of the status bar. [#845](https://github.com/github/vscode-codeql/pull/845)
- Ensure changes in directories that contain tests will be properly updated in the test explorer. [#846](https://github.com/github/vscode-codeql/pull/846)
- Remind users to choose a language when downloading a database from LGTM. [#852](https://github.com/github/vscode-codeql/pull/852)

## 1.4.7 - 23 April 2021

- Fix a bug that prevented the results view from being loaded. [#842](https://github.com/github/vscode-codeql/pull/842)

## 1.4.6 - 21 April 2021

- Avoid showing an error popup when running a query with `@kind table` metadata. [#814](https://github.com/github/vscode-codeql/pull/814)
- Add an option to jump from a .qlref file to the .ql file it references. [#815](https://github.com/github/vscode-codeql/pull/815)
- Avoid opening the results panel when a database is deleted. [#831](https://github.com/github/vscode-codeql/pull/831)
- Forward all query metadata to the CLI when interpreting results. [#838](https://github.com/github/vscode-codeql/pull/838)

## 1.4.5 - 22 March 2021

- Avoid showing an error popup when user runs a query without `@kind` metadata. [#801](https://github.com/github/vscode-codeql/pull/801)
- Fix running of tests when the `ms-python` extension is installed. [#803](https://github.com/github/vscode-codeql/pull/803)

## 1.4.4 - 19 March 2021

- Introduce evaluator options for saving intermediate results to the disk cache (`codeQL.runningQueries.saveCache`) and for limiting the size of this cache (`codeQL.runningQueries.cacheSize`). [#778](https://github.com/github/vscode-codeql/pull/778)
- Respect the `codeQL.runningQueries.numberOfThreads` setting when creating SARIF files during result interpretation. [#771](https://github.com/github/vscode-codeql/pull/771)
- Allow using raw LGTM project slugs for fetching LGTM databases. [#769](https://github.com/github/vscode-codeql/pull/769)
- Better error messages when BQRS interpretation fails to produce SARIF. [#770](https://github.com/github/vscode-codeql/pull/770)
- Implement sorting of the query history view by name, date, and results count. [#777](https://github.com/github/vscode-codeql/pull/777)
- Add a configuration option to pass additional arguments to the CLI when running tests. [#785](https://github.com/github/vscode-codeql/pull/785)
- Introduce option to view query results as CSV. [#784](https://github.com/github/vscode-codeql/pull/784)
- Add some snippets for commonly used QL statements. [#782](https://github.com/github/vscode-codeql/pull/782)
- More descriptive error messages on QL test failures. [#788](https://github.com/github/vscode-codeql/pull/788)

## 1.4.3 - 22 February 2021

- Avoid displaying an error when removing orphaned databases and the storage folder does not exist. [#748](https://github.com/github/vscode-codeql/pull/748)
- Add better error messages when AST Viewer is unable to create an AST. [#753](https://github.com/github/vscode-codeql/pull/753)
- Cache AST viewing operations so that subsequent calls to view the AST of a single file will be extremely fast. [#753](https://github.com/github/vscode-codeql/pull/753)
- Ensure CodeQL version in status bar updates correctly when version changes. [#754](https://github.com/github/vscode-codeql/pull/754)
- Avoid deleting the quick query file when it is re-opened. [#747](https://github.com/github/vscode-codeql/pull/747)

## 1.4.2 - 2 February 2021

- Add a status bar item for the CodeQL CLI to show the current version. [#741](https://github.com/github/vscode-codeql/pull/741)
- Fix version constraint for flagging CLI support of non-destructive updates. [#744](https://github.com/github/vscode-codeql/pull/744)
- Add a _More Information_ button in the telemetry popup that opens the [telemetry documentation](https://codeql.github.com/docs/codeql-for-visual-studio-code/about-telemetry-in-codeql-for-visual-studio-code) in a browser tab. [#742](https://github.com/github/vscode-codeql/pull/742)

## 1.4.1 - 29 January 2021

- Reword the telemetry modal dialog box. [#738](https://github.com/github/vscode-codeql/pull/738)

## 1.4.0 - 29 January 2021

- Fix bug where databases are not reregistered when the query server restarts. [#734](https://github.com/github/vscode-codeql/pull/734)
- Fix bug where upgrade requests were erroneously being marked as failed. [#734](https://github.com/github/vscode-codeql/pull/734)
- On a strictly opt-in basis, collect anonymized usage data from the VS Code extension, helping improve CodeQL's usability and performance. See the [telemetry documentation](https://codeql.github.com/docs/codeql-for-visual-studio-code/about-telemetry-in-codeql-for-visual-studio-code) for more information on exactly what data is collected and what it is used for. [#611](https://github.com/github/vscode-codeql/pull/611)

## 1.3.10 - 20 January 2021

- Include the full stack in error log messages to help with debugging. [#726](https://github.com/github/vscode-codeql/pull/726)

## 1.3.9 - 12 January 2021

- No changes visible to end users.

## 1.3.8 - 17 December 2020

- Ensure databases are unlocked when removing them from the workspace. This will ensure that after a database is removed from VS Code, queries can be run on it from the command line without restarting the IDE. Requires CodeQL CLI 2.4.1 or later. [#681](https://github.com/github/vscode-codeql/pull/681)
- Fix bug when removing databases where sometimes the source folder would not also be removed from the workspace or the database files would not be deleted from the workspace storage location. [#692](https://github.com/github/vscode-codeql/pull/692)
- Query results with no string representation will now be displayed with placeholder text in query results. Previously, they were omitted. [#694](https://github.com/github/vscode-codeql/pull/694)
- Add a label for the language of a database in the databases view. This will only take effect for new databases created with the CodeQL CLI v2.4.1 or later. [#697](https://github.com/github/vscode-codeql/pull/697)
- Add clearer error message when running a query using a missing or invalid qlpack. [#702](https://github.com/github/vscode-codeql/pull/702)
- Add clearer error message when trying to run a command from the query history view if no item in the history is selected. [#702](https://github.com/github/vscode-codeql/pull/702)
- Fix a bug where it is not possible to download some database archives. This fix specifically addresses large archives and archives whose central directories do not align with file headers. [#700](https://github.com/github/vscode-codeql/pull/700)
- Avoid error dialogs when QL test discovery or database cleanup encounters a missing directory. [#706](https://github.com/github/vscode-codeql/pull/706)
- Add descriptive text and a link in the results view. [#711](https://github.com/github/vscode-codeql/pull/711)
- Fix the _Set Label_ command in the query history view. [#710](https://github.com/github/vscode-codeql/pull/710)
- Add the _CodeQL: View AST_ command to the right-click context menu when a source file in a database source archive is open in the editor. [#712](https://github.com/github/vscode-codeql/pull/712)

## 1.3.7 - 24 November 2020

- Editors opened by navigating from the results view are no longer opened in _preview mode_. Now they are opened as a persistent editor. [#630](https://github.com/github/vscode-codeql/pull/630)
- When comparing the results of a failed QL test run and the `.expected` file does not exist, an empty `.expected` file is created and compared against the `.actual` file. [#669](https://github.com/github/vscode-codeql/pull/669)
- Alter structure of the _Test Explorer_ tree. It now follows the structure of the filesystem instead of the QL Packs. [#624](https://github.com/github/vscode-codeql/pull/624)
- Alter structure of the _Test Explorer_ tree. It now follows the structure of the filesystem instead of the QL Packs. [#624](https://github.com/github/vscode-codeql/pull/624)
- Add more structured output for tests. [#626](https://github.com/github/vscode-codeql/pull/626)
- Whenever the extension restarts, orphaned databases will be cleaned up. These are databases whose files are located inside of the extension's storage area, but are not imported into the workspace.
- After renaming a database, the database list is re-sorted. [#685](https://github.com/github/vscode-codeql/pull/685)
- Add a `codeQl.resultsDisplay.pageSize` setting to configure the number of results displayed in a single results view page. Increase the default page size from 100 to 200. [#686](https://github.com/github/vscode-codeql/pull/686)
- Update the AST Viewer to include edge labels (if available) in addition to the target node labels. So far, only C/C++ databases take advantage of this change. [#688](https://github.com/github/vscode-codeql/pull/688)

## 1.3.6 - 4 November 2020

- Fix URI encoding for databases that were created with special characters in their paths. [#648](https://github.com/github/vscode-codeql/pull/648)
- Disable CodeQL Test commands from the command palette [#667](https://github.com/github/vscode-codeql/pull/667)
- Fix display of booleans in results view. [#657](https://github.com/github/vscode-codeql/pull/657)
- Avoid recursive selection changes in AST Viewer. [#668](https://github.com/github/vscode-codeql/pull/668)

## 1.3.5 - 27 October 2020

- Fix a bug where archived source folders for databases were not showing any contents.
- Fix URI encoding for databases that were created with special characters in their paths.

## 1.3.4 - 22 October 2020

- Add friendly welcome message when the databases view is empty.
- Add open query, open results, and remove query commands in the query history view title bar.
- The maximum number of simultaneous queries launchable by the `CodeQL: Run Queries in Selected Files` command is now configurable by changing the `codeQL.runningQueries.maxQueries` setting.
- Allow simultaneously run queries to be canceled in a single-click.
- Prevent multiple upgrade dialogs from appearing when running simultaneous queries on upgradeable databases.
- Fix sorting of results. Some pages of results would have the wrong sort order and columns.
- Remember previous sort order when reloading query results.
- Fix proper escaping of backslashes in SARIF message strings.
- Allow setting `codeQL.runningQueries.numberOfThreads` and `codeQL.runningTests.numberOfThreads` to 0, (which is interpreted as 'use one thread per core on the machine').
- Clear the problems view of all CodeQL query results when a database is removed.
- Add a `View DIL` command on query history items. This opens a text editor containing the Datalog Intermediary Language representation of the compiled query.
- Remove feature flag for the AST Viewer. For more information on how to use the AST Viewer, [see the documentation](https://help.semmle.com/codeql/codeql-for-vscode/procedures/exploring-the-structure-of-your-source-code.html).
- The `codeQL.runningTests.numberOfThreads` setting is now used correctly when running tests.
- Alter structure of the _Test Explorer_ tree. It now follows the structure of the filesystem instead of the qlpacks.
- Ensure output of CodeQL test runs includes compilation error messages and test failure messages.

## 1.3.3 - 16 September 2020

- Fix display of raw results entities with label but no url.
- Fix bug where sort order is forgotten when changing raw results page.
- Avoid showing a location link in results view when a result item has an empty location.

## 1.3.2 - 12 August 2020

- Fix error with choosing qlpack search path.
- Fix pagination when there are no results.
- Suppress database downloaded from URL message when action canceled.
- Fix QL test discovery to avoid showing duplicate tests in the test explorer.
- Enable pagination of query results
- Add experimental AST Viewer for Go and C++. To enable, add `"codeQL.experimentalAstViewer": true` to the user settings file.

## 1.3.1 - 7 July 2020

- Fix unzipping of large files.
- Ensure compare order is consistent when selecting two queries to compare. The first query selected is always the _from_ query and the query selected later is always the _to_ query.
- Ensure added databases have zipped source locations for databases added as archives or downloaded from the internet.
- Fix bug where it is not possible to add databases starting with `db-*`.
- Change styling of pagination section of the results page.
- Fix display of query text for stored quick queries.

## 1.3.0 - 22 June 2020

- Report error when selecting invalid database.
- Add descriptive message for database archive import failure.
- Respect VS Code's i18n locale setting when formatting dates and sorting strings.
- Allow the opening of large SARIF files externally from VS Code.
- Add new 'CodeQL: Compare Query' command that shows the differences between two queries.
- Allow multiple items in the query history view to be removed in one operation.
- Allow multiple items in the databases view to be removed in one operation.
- Allow multiple items in the databases view to be upgraded in one operation.
- Allow multiple items in the databases view to have their external folders opened.
- Allow all selected queries to be run in one command from the file explorer.

## 1.2.2 - 8 June 2020

- Fix auto-indentation rules.
- Add ability to download platform-specific releases of the CodeQL CLI if they are available.
- Fix handling of downloading prerelease versions of the CodeQL CLI.
- Add pagination for displaying non-interpreted results.

## 1.2.1 - 29 May 2020

- Better formatting and autoindentation when adding QLDoc comments to `.ql` and `.qll` files.
- Allow for more flexibility when opening a database in the workspace. A user can now choose the actual database folder, or the nested `db-*` folder.
- Add query history menu command for viewing corresponding SARIF file.
- Add ability for users to download databases directly from LGTM.com.

## 1.2.0 - 19 May 2020

- Enable 'Go to Definition' and 'Go to References' on source archive
  files in CodeQL databases. This is handled by a CodeQL query.
- Fix adding database archive files on Windows.
- Enable adding remote and local database archive files from the
  command palette.

## 1.1.5 - 15 May 2020

- Links in results are no longer underlined and monospaced.
- Add the ability to choose a database either from an archive, a folder, or from the internet.
- New icons for commands on the databases view.

## 1.1.4 - 13 May 2020

- Add the ability to download and install databases archives from the internet.

## 1.1.3 - 8 May 2020

- Add a suggestion in alerts view to view raw results, when there are
  raw results but no alerts.
- Add the ability to rename databases in the database view.
- Add the ability to open the directory in the filesystem
  of a database.

## 1.1.2 - 28 April 2020

- Implement syntax highlighting for the new `unique` aggregate.
- Implement XML syntax highlighting for `.qhelp` files.
- Add option to auto save queries before running them.
- Add new command in query history to view the query text of the
  selected query (note that this may be different from the current
  contents of the query file if the file has been edited).
- Add ability to sort CodeQL databases by name or by date added.

## 1.1.1 - 23 March 2020

- Fix quick evaluation in `.qll` files.
- Add new command in query history view to view the log file of a
  query.
- Request user acknowledgment before updating the CodeQL binaries.
- Warn when using the deprecated `codeql.cmd` launcher on Windows.

## 1.1.0 - 17 March 2020

- Add functionality for testing custom CodeQL queries by using the VS
  Code Test Explorer extension and `codeql test`. See the documentation for
  more details.
- Add a "Show log" button to all information, error, and warning
  popups that will display the CodeQL extension log.
- Display a message when a query times out.
- Show canceled queries in query history.
- Improve error messages when attempting to run non-query files.

## 1.0.6 - 28 February 2020

- Add command to restart query server.
- Enable support for future minor upgrades to the CodeQL CLI.

## 1.0.5 - 13 February 2020

- Add an icon next to any failed query runs in the query history
  view.
- Add the ability to sort alerts by alert message.

## 1.0.4 - 24 January 2020

- Disable word-based autocomplete by default.
- Add command `CodeQL: Quick Query` for easy query creation without
  having to choose a place in the filesystem to store the query file.

## 1.0.3 - 13 January 2020

- Reduce the frequency of CodeQL CLI update checks to help avoid hitting GitHub API limits of 60 requests per
  hour for unauthenticated IPs.
- Fix sorting of result sets with names containing special characters.

## 1.0.2 - 13 December 2019

- Fix rendering of negative numbers in results.
- Allow customization of query history labels from settings and from
  query history view context menu.
- Show number of results in results view.
- Add commands `CodeQL: Show Next Step on Path` and `CodeQL: Show Previous Step on Path` for navigating the steps on the currently
  shown path result.

## 1.0.1 - 21 November 2019

- Change `codeQL.cli.executablePath` to a per-machine setting, so it can no longer be set at the user or workspace level. This helps prevent arbitrary code execution when using a VS Code workspace from an untrusted source.
- Improve the highlighting of the selected query result within the source code.
- Improve the performance of switching between result tables in the CodeQL Query Results view.
- Fix the automatic upgrading of CodeQL databases when using upgrade scripts from the workspace.
- Allow removal of items from the CodeQL Query History view.

## 1.0.0 - 14 November 2019

Initial release of CodeQL for Visual Studio Code.
