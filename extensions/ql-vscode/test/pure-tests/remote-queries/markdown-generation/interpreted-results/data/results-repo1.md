### github/codeql

[javascript/ql/src/Security/CWE-078/examples/shell-command-injection-from-environment.js](https://github.com/github/codeql/blob/48015e5a2e6202131f2d1062cc066dc33ed69a9b/javascript/ql/src/Security/CWE-078/examples/shell-command-injection-from-environment.js#L5-L5)

```javascript
function cleanupTemp() {
  let cmd = "rm -rf " + path.join(__dirname, "temp");
  cp.execSync(cmd); // BAD
}

```

This shell command depends on an uncontrolled [absolute path](https://github.com/github/codeql/blob/48015e5a2e6202131f2d1062cc066dc33ed69a9b/javascript/ql/src/Security/CWE-078/examples/shell-command-injection-from-environment.js#L4-L4).

----------------------------------------

[javascript/ql/test/query-tests/Security/CWE-078/tst_shell-command-injection-from-environment.js](https://github.com/github/codeql/blob/48015e5a2e6202131f2d1062cc066dc33ed69a9b/javascript/ql/test/query-tests/Security/CWE-078/tst_shell-command-injection-from-environment.js#L6-L6)

```javascript
(function() {
	cp.execFileSync('rm',  ['-rf', path.join(__dirname, "temp")]); // GOOD
	cp.execSync('rm -rf ' + path.join(__dirname, "temp")); // BAD

	execa.shell('rm -rf ' + path.join(__dirname, "temp")); // NOT OK

```

This shell command depends on an uncontrolled [absolute path](https://github.com/github/codeql/blob/48015e5a2e6202131f2d1062cc066dc33ed69a9b/javascript/ql/test/query-tests/Security/CWE-078/tst_shell-command-injection-from-environment.js#L6-L6).

----------------------------------------

[javascript/ql/test/query-tests/Security/CWE-078/tst_shell-command-injection-from-environment.js](https://github.com/github/codeql/blob/48015e5a2e6202131f2d1062cc066dc33ed69a9b/javascript/ql/test/query-tests/Security/CWE-078/tst_shell-command-injection-from-environment.js#L8-L8)

```javascript
	cp.execSync('rm -rf ' + path.join(__dirname, "temp")); // BAD

	execa.shell('rm -rf ' + path.join(__dirname, "temp")); // NOT OK
	execa.shellSync('rm -rf ' + path.join(__dirname, "temp")); // NOT OK


```

This shell command depends on an uncontrolled [absolute path](https://github.com/github/codeql/blob/48015e5a2e6202131f2d1062cc066dc33ed69a9b/javascript/ql/test/query-tests/Security/CWE-078/tst_shell-command-injection-from-environment.js#L8-L8).

----------------------------------------

[javascript/ql/test/query-tests/Security/CWE-078/tst_shell-command-injection-from-environment.js](https://github.com/github/codeql/blob/48015e5a2e6202131f2d1062cc066dc33ed69a9b/javascript/ql/test/query-tests/Security/CWE-078/tst_shell-command-injection-from-environment.js#L9-L9)

```javascript

	execa.shell('rm -rf ' + path.join(__dirname, "temp")); // NOT OK
	execa.shellSync('rm -rf ' + path.join(__dirname, "temp")); // NOT OK

	const safe = "\"" + path.join(__dirname, "temp") + "\"";

```

This shell command depends on an uncontrolled [absolute path](https://github.com/github/codeql/blob/48015e5a2e6202131f2d1062cc066dc33ed69a9b/javascript/ql/test/query-tests/Security/CWE-078/tst_shell-command-injection-from-environment.js#L9-L9).

----------------------------------------
