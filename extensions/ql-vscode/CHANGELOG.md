# CodeQL for Visual Studio Code: Changelog

## [UNRELEASED]

- Add a code lens to make the `CodeQL: Open Referenced File` command more discoverable. Click the "Open referenced file" prompt in a `.qlref` file to jump to the referenced `.ql` file. [#2704](https://github.com/github/vscode-codeql/pull/2704)

## 1.8.9 - 3 August 2023

- Remove "last updated" information and sorting from variant analysis results view. [#2637](https://github.com/github/vscode-codeql/pull/2637)
- Links to code on GitHub now include column numbers as well as line numbers. [#2406](https://github.com/github/vscode-codeql/pull/2406)
- No longer highlight trailing commas for jump to definition.  [#2615](https://github.com/github/vscode-codeql/pull/2615)
- Fix a bug where the QHelp preview page was not being refreshed after changes to the underlying `.qhelp` file. [#2660](https://github.com/github/vscode-codeql/pull/2660)

## 1.8.8 - 17 July 2023

- Remove support for CodeQL CLI versions older than 2.9.4. [#2610](https://github.com/github/vscode-codeql/pull/2610)
- Implement syntax highlighting for the `additional` and `default` keywords. [#2609](https://github.com/github/vscode-codeql/pull/2609)

## 1.8.7 - 29 June 2023

- Show a run button on the file tab for query files, that will start a local query. This button will only show when a local database is selected in the extension. [#2544](https://github.com/github/vscode-codeql/pull/2544)
- Add a `CodeQL: Quick Evaluation Count` command to generate the count summary statistics of the results set
  without spending the time to compute locations and strings. [#2475](https://github.com/github/vscode-codeql/pull/2475)

## 1.8.6 - 14 June 2023

- Add repositories to a variant analysis list with GitHub Code Search. [#2439](https://github.com/github/vscode-codeql/pull/2439) and [#2476](https://github.com/github/vscode-codeql/pull/2476)

## 1.8.5 - 6 June 2023

- Add settings `codeQL.variantAnalysis.defaultResultsFilter` and `codeQL.variantAnalysis.defaultResultsSort` for configuring how variant analysis results are filtered and sorted in the results view. The default is to show all repositories, and to sort by the number of results. [#2392](https://github.com/github/vscode-codeql/pull/2392)
- Fix bug to ensure error messages have complete stack trace in message logs. [#2425](https://github.com/github/vscode-codeql/pull/2425)
- Fix bug where the `CodeQL: Compare Query` command did not work for comparing quick-eval queries. [#2422](https://github.com/github/vscode-codeql/pull/2422)
- Update text of copy and export buttons in variant analysis results view to clarify that they only copy/export the selected/filtered results. [#2427](https://github.com/github/vscode-codeql/pull/2427)
- Add warning when using unsupported CodeQL CLI version. [#2428](https://github.com/github/vscode-codeql/pull/2428)
- Retry variant analysis results download if connection times out. [#2440](https://github.com/github/vscode-codeql/pull/2440)

## 1.8.4 - 3 May 2023

- Avoid repeated error messages when unable to monitor a variant analysis. [#2396](https://github.com/github/vscode-codeql/pull/2396)
- Fix bug where a variant analysis didn't display the `#select` results set correctly when the [query metadata](https://codeql.github.com/docs/writing-codeql-queries/about-codeql-queries/#query-metadata) didn't exactly match the query results. [#2395](https://github.com/github/vscode-codeql/pull/2395)
- On the variant analysis results page, show the count of successful analyses instead of completed analyses, and indicate the reason why analyses were not successful. [#2349](https://github.com/github/vscode-codeql/pull/2349)
- Fix bug where the "CodeQL: Set Current Database" command didn't always select the database. [#2384](https://github.com/github/vscode-codeql/pull/2384)

## 1.8.3 - 26 April 2023

- Added ability to filter repositories for a variant analysis to only those that have results [#2343](https://github.com/github/vscode-codeql/pull/2343)
- Add new configuration option to allow downloading databases from http, non-secure servers. [#2332](https://github.com/github/vscode-codeql/pull/2332)
- Remove title actions from the query history panel that depended on history items being selected. [#2350](https://github.com/github/vscode-codeql/pull/2350)

## 1.8.2 - 12 April 2023

- Fix bug where users could end up with the managed CodeQL CLI getting uninstalled during upgrades and not reinstalled. [#2294](https://github.com/github/vscode-codeql/pull/2294)
- Fix bug that was causing code flows to not get updated when switching between results. [#2288](https://github.com/github/vscode-codeql/pull/2288)
- Restart the CodeQL language server whenever the _CodeQL: Restart Query Server_ command is invoked. This avoids bugs where the CLI version changes to support new language features, but the language server is not updated. [#2238](https://github.com/github/vscode-codeql/pull/2238)
- Avoid requiring a manual restart of the query server when the [external CLI config file](https://docs.github.com/en/code-security/codeql-cli/using-the-codeql-cli/specifying-command-options-in-a-codeql-configuration-file#using-a-codeql-configuration-file) changes. [#2289](https://github.com/github/vscode-codeql/pull/2289)

## 1.8.1 - 23 March 2023

- Show data flow paths of a variant analysis in a new tab. [#2172](https://github.com/github/vscode-codeql/pull/2172) & [#2182](https://github.com/github/vscode-codeql/pull/2182)
- Show labels of entities in exported CSV results. [#2170](https://github.com/github/vscode-codeql/pull/2170)

## 1.8.0 - 9 March 2023

- Send telemetry about unhandled errors happening within the extension. [#2125](https://github.com/github/vscode-codeql/pull/2125)
- Enable multi-repository variant analysis. [#2144](https://github.com/github/vscode-codeql/pull/2144)

## 1.7.11 - 1 March 2023

- Enable collection of telemetry concerning interactions with UI elements, including buttons, links, and other inputs. [#2114](https://github.com/github/vscode-codeql/pull/2114)
- Prevent the automatic installation of CodeQL CLI version 2.12.3 to avoid a bug in the language server. CodeQL CLI 2.12.2 will be used instead. [#2126](https://github.com/github/vscode-codeql/pull/2126)

## 1.7.10 - 23 February 2023

- Fix bug that was causing unwanted error notifications.

## 1.7.9 - 20 February 2023

No user facing changes.

## 1.7.8 - 2 February 2023

- Renamed command "CodeQL: Run Query" to "CodeQL: Run Query on Selected Database". [#1962](https://github.com/github/vscode-codeql/pull/1962)
- Remove support for CodeQL CLI versions older than 2.7.6. [#1788](https://github.com/github/vscode-codeql/pull/1788)

## 1.7.7 - 13 December 2022

- Increase the required version of VS Code to 1.67.0. [#1662](https://github.com/github/vscode-codeql/pull/1662)

## 1.7.6 - 21 November 2022

- Warn users when their VS Code version is too old to support all features in the vscode-codeql extension. [#1674](https://github.com/github/vscode-codeql/pull/1674)

## 1.7.5 - 8 November 2022

- Fix a bug where the AST Viewer was not working unless the associated CodeQL library pack is in the workspace. [#1735](https://github.com/github/vscode-codeql/pull/1735)

## 1.7.4 - 29 October 2022

No user facing changes.

## 1.7.3 - 28 October 2022

- Fix a bug where databases may be lost if VS Code is restarted while the extension is being started up. [#1638](https://github.com/github/vscode-codeql/pull/1638)
- Add commands for navigating up, down, left, or right in the result viewer. Previously there were only commands for moving up and down the currently-selected path. We suggest binding keyboard shortcuts to these commands, for navigating the result viewer using the keyboard. [#1568](https://github.com/github/vscode-codeql/pull/1568)

## 1.7.2 - 14 October 2022

- Fix a bug where results created in older versions were thought to be unsuccessful. [#1605](https://github.com/github/vscode-codeql/pull/1605)

## 1.7.1 - 12 October 2022

- Fix a bug where it was not possible to add a database folder if the folder name starts with `db-`. [#1565](https://github.com/github/vscode-codeql/pull/1565)
- Ensure the results view opens in an editor column beside the currently active editor. [#1557](https://github.com/github/vscode-codeql/pull/1557)

## 1.7.0 - 20 September 2022

- Remove ability to download databases from LGTM. [#1467](https://github.com/github/vscode-codeql/pull/1467)
- Remove the ability to manually upgrade databases from the context menu on databases. Databases are non-destructively upgraded automatically so for most users this was not needed. For advanced users this is still available in the Command Palette. [#1501](https://github.com/github/vscode-codeql/pull/1501)
- Always restart the query server after a manual database upgrade. This avoids a bug in the query server where an invalid dbscheme was being retained in memory after an upgrade. [#1519](https://github.com/github/vscode-codeql/pull/1519)

## 1.6.12 - 1 September 2022

- Add ability for users to download databases directly from GitHub. [#1485](https://github.com/github/vscode-codeql/pull/1485)
- Fix a race condition that could cause a failure to open the evaluator log when running a query. [#1490](https://github.com/github/vscode-codeql/pull/1490)
- Fix an error when running a query with an older version of the CodeQL CLI. [#1490](https://github.com/github/vscode-codeql/pull/1490)

## 1.6.11 - 25 August 2022

No user facing changes.

## 1.6.10 - 9 August 2022

No user facing changes.

## 1.6.9 - 20 July 2022

No user facing changes.

## 1.6.8 - 29 June 2022

- Fix a bug where quick queries cannot be compiled if the core libraries are not in the workspace. [#1411](https://github.com/github/vscode-codeql/pull/1411)
- Fix a bug where quick evaluation of library files would display an error message when using CodeQL CLI v2.10.0. [#1412](https://github.com/github/vscode-codeql/pull/1412)

## 1.6.7 - 15 June 2022

- Prints end-of-query evaluator log summaries to the Query Log. [#1349](https://github.com/github/vscode-codeql/pull/1349)
- Be consistent about casing in Query History menu. [#1369](https://github.com/github/vscode-codeql/pull/1369)
- Fix quoting string columns in exported CSV results. [#1379](https://github.com/github/vscode-codeql/pull/1379)

## 1.6.6 - 17 May 2022

No user facing changes.

## 1.6.5 - 25 April 2022

- Re-enable publishing to open-vsx. [#1285](https://github.com/github/vscode-codeql/pull/1285)

## 1.6.4 - 6 April 2022

No user facing changes.

## 1.6.3 - 4 April 2022

- Fix a bug where the AST viewer was not synchronizing its selected node when the editor selection changes. [#1230](https://github.com/github/vscode-codeql/pull/1230)
- Avoid synchronizing the `codeQL.cli.executablePath` setting. [#1252](https://github.com/github/vscode-codeql/pull/1252)
- Open the directory in the finder/explorer (instead of just highlighting it) when running the "Open query directory" command from the query history view. [#1235](https://github.com/github/vscode-codeql/pull/1235)
- Ensure query label in the query history view changes are persisted across restarts. [#1235](https://github.com/github/vscode-codeql/pull/1235)
- Prints end-of-query evaluator log summaries to the Query Server Console. [#1264](https://github.com/github/vscode-codeql/pull/1264)

## 1.6.1 - 17 March 2022

No user facing changes.

## 1.6.0 - 7 March 2022

- Fix a bug where database upgrades could not be resolved if some of the target pack's dependencies are outside of the workspace. [#1138](https://github.com/github/vscode-codeql/pull/1138)
- Open the query server logs for query errors (instead of the extension log). This will make it easier to track down query errors. [#1158](https://github.com/github/vscode-codeql/pull/1158)
- Fix a bug where queries took a long time to run if there are no folders in the workspace. [#1157](https://github.com/github/vscode-codeql/pull/1157)
- [BREAKING CHANGE] The `codeQL.runningQueries.customLogDirectory` setting is deprecated and no longer has any function. Instead, all query log files will be stored in the query history directory, next to the query results. [#1178](https://github.com/github/vscode-codeql/pull/1178)
- Add a _Open query directory_ command for query items. This command opens the directory containing all artifacts for a query. [#1179](https://github.com/github/vscode-codeql/pull/1179)
- Add options to display evaluator logs for a given query run. Some information that was previously found in the query server output may now be found here. [#1186](https://github.com/github/vscode-codeql/pull/1186)

## 1.5.11 - 10 February 2022

- Fix a bug where invoking _View AST_ from the file explorer would not view the selected file. Instead it would view the active editor. Also, prevent the _View AST_ from appearing if the current selection includes a directory or multiple files. [#1113](https://github.com/github/vscode-codeql/pull/1113)
- Add query history items as soon as a query is run, including new icons for each history item. [#1094](https://github.com/github/vscode-codeql/pull/1094)
- Save query history items across restarts. Items will be saved for 30 days and can be overwritten by setting the `codeQL.queryHistory.ttl` configuration setting. [#1130](https://github.com/github/vscode-codeql/pull/1130)
- Allow in-progress query items to be cancelled from the query history view. [#1105](https://github.com/github/vscode-codeql/pull/1105)

## 1.5.10 - 25 January 2022

- Fix a bug where the results view moved column even when it was already visible. [#1070](https://github.com/github/vscode-codeql/pull/1070)
- Add packaging-related commands. _CodeQL: Download Packs_ downloads query packs from the package registry that can be run locally, and _CodeQL: Install Pack Dependencies_ installs dependencies for packs in your workspace. [#1076](https://github.com/github/vscode-codeql/pull/1076)

## 1.5.9 - 17 December 2021

- Avoid creating a third column when opening the results view. The results view will always open to the right of the active editor, unless the active editor is in the rightmost editor column. In that case open in the leftmost column. [#1037](https://github.com/github/vscode-codeql/pull/1037)
- Add a CodeLens to make the Quick Evaluation command more accessible. Click the `Quick Evaluation` prompt above a predicate definition in the editor to evaluate that predicate on its own. You can enable/disable this feature in the `codeQL.runningQueries.quickEvalCodelens` setting. [#1035](https://github.com/github/vscode-codeql/pull/1035) & [#1052](https://github.com/github/vscode-codeql/pull/1052)
- Fix a bug where the _Alerts_ option would show in the results view even if there is no alerts table available. [#1038](https://github.com/github/vscode-codeql/pull/1038)

## 1.5.8 - 2 December 2021

- Emit a more explicit error message when a user tries to add a database with an unzipped source folder to the workspace. [#1021](https://github.com/github/vscode-codeql/pull/1021)
- Ensure `src.zip` archives are used as the canonical source instead of `src` folders when importing databases. [#1025](https://github.com/github/vscode-codeql/pull/1025)

## 1.5.7 - 23 November 2021

- Fix the _CodeQL: Open Referenced File_ command for Windows systems. [#979](https://github.com/github/vscode-codeql/pull/979)
- Support large SARIF results files (>4GB) without crashing VS Code. [#1004](https://github.com/github/vscode-codeql/pull/1004)
- Fix a bug that shows 'Set current database' when hovering over the currently selected database in the databases view. [#976](https://github.com/github/vscode-codeql/pull/976)
- Fix a bug with importing large databases. Databases over 4GB can now be imported directly from LGTM or from a zip file. This functionality is only available when using CodeQL CLI version 2.6.0 or later. [#971](https://github.com/github/vscode-codeql/pull/971)
- Replace certain control codes (`U+0000` - `U+001F`) with their corresponding control labels (`U+2400` - `U+241F`) in the results view. [#963](https://github.com/github/vscode-codeql/pull/963)
- Allow case-insensitive project slugs for GitHub repositories when adding a CodeQL database from LGTM. [#978](https://github.com/github/vscode-codeql/pull/961)
- Add a _CodeQL: Preview Query Help_ command to generate Markdown previews of `.qhelp` query help files. This command should only be run in trusted workspaces. See [the CodeQL CLI docs](https://codeql.github.com/docs/codeql-cli/testing-query-help-files) for more information about query help. [#988](https://github.com/github/vscode-codeql/pull/988)
- Make "Open Referenced File" command accessible from the active editor menu. [#989](https://github.com/github/vscode-codeql/pull/989)
- Fix a bug where result set names in the result set drop-down were disappearing when viewing a sorted table. [#1007](https://github.com/github/vscode-codeql/pull/1007)
- Allow query result locations with 0 as the end column value. These are treated as the first column in the line. [#1002](https://github.com/github/vscode-codeql/pull/1002)

## 1.5.6 - 07 October 2021

- Add progress messages to LGTM download option. This makes the two-step process (selecting a project, then selecting a language) more clear. [#960](https://github.com/github/vscode-codeql/pull/960)
- Remove line about selecting a language from the dropdown when downloading database from LGTM. This makes the download progress visible when the popup is not expanded. [#957](https://github.com/github/vscode-codeql/pull/957)
- Fix a bug where copying the version information fails when a CodeQL CLI cannot be found. [#958](https://github.com/github/vscode-codeql/pull/958)
- Avoid a race condition when deleting databases that can cause occasional errors. [#959](https://github.com/github/vscode-codeql/pull/959)
- Update CodeQL logos. [#965](https://github.com/github/vscode-codeql/pull/965)

## 1.5.5 - 08 September 2021

- Fix bug where a query is sometimes run before the file is saved. [#947](https://github.com/github/vscode-codeql/pull/947)
- Fix broken contextual queries, including _View AST_. [#949](https://github.com/github/vscode-codeql/pull/949)

## 1.5.4 - 02 September 2021

- Add support for filename pattern in history view. [#930](https://github.com/github/vscode-codeql/pull/930)
- Add an option _View Results (CSV)_ to view the results of a non-alert query. The existing options for alert queries have been renamed to _View Alerts_ to avoid confusion. [#929](https://github.com/github/vscode-codeql/pull/929)
- Allow users to specify the number of paths to display for each alert. [#931](https://github.com/github/vscode-codeql/pull/931)
- Adjust pagination controls in _CodeQL Query Results_ to always be visible [#936](https://github.com/github/vscode-codeql/pull/936)
- Fix bug where _View AST_ fails due to recent refactoring in the standard library and query packs. [#939](https://github.com/github/vscode-codeql/pull/939)

## 1.5.3 - 18 August 2021

- Add a command _CodeQL: Run Query on Multiple Databases_, which lets users select multiple databases to run a query on. [#898](https://github.com/github/vscode-codeql/pull/898)
- Autodetect what language a query targets. This refines the _CodeQL: Run Query on Multiple Databases_ command to only show relevant databases. [#915](https://github.com/github/vscode-codeql/pull/915)
- Adjust test log output to display diffs only when comparing failed test results with expected test results. [#920](https://github.com/github/vscode-codeql/pull/920)

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
