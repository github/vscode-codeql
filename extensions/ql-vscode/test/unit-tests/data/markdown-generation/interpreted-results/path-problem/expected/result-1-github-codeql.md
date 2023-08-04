### github/codeql

[javascript/ql/src/Security/CWE-078/examples/shell-command-injection-from-environment.js](https://github.com/github/codeql/blob/48015e5a2e6202131f2d1062cc066dc33ed69a9b/javascript/ql/src/Security/CWE-078/examples/shell-command-injection-from-environment.js#L5C15-L5C18)

<pre><code class="javascript">function cleanupTemp() {
  let cmd = "rm -rf " + path.join(__dirname, "temp");
  cp.execSync(<strong>cmd</strong>); // BAD
}
</code></pre>

*This shell command depends on an uncontrolled [absolute path](https://github.com/github/codeql/blob/48015e5a2e6202131f2d1062cc066dc33ed69a9b/javascript/ql/src/Security/CWE-078/examples/shell-command-injection-from-environment.js#L4C35-L4C44).*

#### Paths

<details>
<summary>Path with 5 steps</summary>

1. [javascript/ql/src/Security/CWE-078/examples/shell-command-injection-from-environment.js](https://github.com/github/codeql/blob/48015e5a2e6202131f2d1062cc066dc33ed69a9b/javascript/ql/src/Security/CWE-078/examples/shell-command-injection-from-environment.js#L4C35-L4C44)
   <pre><code class="javascript">  path = require("path");
   function cleanupTemp() {
     let cmd = "rm -rf " + path.join(<strong>__dirname</strong>, "temp");
     cp.execSync(cmd); // BAD
   }
   </code></pre>

2. [javascript/ql/src/Security/CWE-078/examples/shell-command-injection-from-environment.js](https://github.com/github/codeql/blob/48015e5a2e6202131f2d1062cc066dc33ed69a9b/javascript/ql/src/Security/CWE-078/examples/shell-command-injection-from-environment.js#L4C25-L4C53)
   <pre><code class="javascript">  path = require("path");
   function cleanupTemp() {
     let cmd = "rm -rf " + <strong>path.join(__dirname, "temp")</strong>;
     cp.execSync(cmd); // BAD
   }
   </code></pre>

3. [javascript/ql/src/Security/CWE-078/examples/shell-command-injection-from-environment.js](https://github.com/github/codeql/blob/48015e5a2e6202131f2d1062cc066dc33ed69a9b/javascript/ql/src/Security/CWE-078/examples/shell-command-injection-from-environment.js#L4C13-L4C53)
   <pre><code class="javascript">  path = require("path");
   function cleanupTemp() {
     let cmd = <strong>"rm -rf " + path.join(__dirname, "temp")</strong>;
     cp.execSync(cmd); // BAD
   }
   </code></pre>

4. [javascript/ql/src/Security/CWE-078/examples/shell-command-injection-from-environment.js](https://github.com/github/codeql/blob/48015e5a2e6202131f2d1062cc066dc33ed69a9b/javascript/ql/src/Security/CWE-078/examples/shell-command-injection-from-environment.js#L4C7-L4C53)
   <pre><code class="javascript">  path = require("path");
   function cleanupTemp() {
     let <strong>cmd = "rm -rf " + path.join(__dirname, "temp")</strong>;
     cp.execSync(cmd); // BAD
   }
   </code></pre>

5. [javascript/ql/src/Security/CWE-078/examples/shell-command-injection-from-environment.js](https://github.com/github/codeql/blob/48015e5a2e6202131f2d1062cc066dc33ed69a9b/javascript/ql/src/Security/CWE-078/examples/shell-command-injection-from-environment.js#L5C15-L5C18)
   <pre><code class="javascript">function cleanupTemp() {
     let cmd = "rm -rf " + path.join(__dirname, "temp");
     cp.execSync(<strong>cmd</strong>); // BAD
   }
   </code></pre>

</details>

----------------------------------------

[javascript/ql/test/query-tests/Security/CWE-078/tst_shell-command-injection-from-environment.js](https://github.com/github/codeql/blob/48015e5a2e6202131f2d1062cc066dc33ed69a9b/javascript/ql/test/query-tests/Security/CWE-078/tst_shell-command-injection-from-environment.js#L6C14-L6C54)

<pre><code class="javascript">(function() {
	cp.execFileSync('rm',  ['-rf', path.join(__dirname, "temp")]); // GOOD
	cp.execSync(<strong>'rm -rf ' + path.join(__dirname, "temp")</strong>); // BAD

	execa.shell('rm -rf ' + path.join(__dirname, "temp")); // NOT OK
</code></pre>

*This shell command depends on an uncontrolled [absolute path](https://github.com/github/codeql/blob/48015e5a2e6202131f2d1062cc066dc33ed69a9b/javascript/ql/test/query-tests/Security/CWE-078/tst_shell-command-injection-from-environment.js#L6C36-L6C45).*

#### Paths

<details>
<summary>Path with 3 steps</summary>

1. [javascript/ql/test/query-tests/Security/CWE-078/tst_shell-command-injection-from-environment.js](https://github.com/github/codeql/blob/48015e5a2e6202131f2d1062cc066dc33ed69a9b/javascript/ql/test/query-tests/Security/CWE-078/tst_shell-command-injection-from-environment.js#L6C36-L6C45)
   <pre><code class="javascript">(function() {
   	cp.execFileSync('rm',  ['-rf', path.join(__dirname, "temp")]); // GOOD
   	cp.execSync('rm -rf ' + path.join(<strong>__dirname</strong>, "temp")); // BAD

   	execa.shell('rm -rf ' + path.join(__dirname, "temp")); // NOT OK
   </code></pre>

2. [javascript/ql/test/query-tests/Security/CWE-078/tst_shell-command-injection-from-environment.js](https://github.com/github/codeql/blob/48015e5a2e6202131f2d1062cc066dc33ed69a9b/javascript/ql/test/query-tests/Security/CWE-078/tst_shell-command-injection-from-environment.js#L6C26-L6C54)
   <pre><code class="javascript">(function() {
   	cp.execFileSync('rm',  ['-rf', path.join(__dirname, "temp")]); // GOOD
   	cp.execSync('rm -rf ' + <strong>path.join(__dirname, "temp")</strong>); // BAD

   	execa.shell('rm -rf ' + path.join(__dirname, "temp")); // NOT OK
   </code></pre>

3. [javascript/ql/test/query-tests/Security/CWE-078/tst_shell-command-injection-from-environment.js](https://github.com/github/codeql/blob/48015e5a2e6202131f2d1062cc066dc33ed69a9b/javascript/ql/test/query-tests/Security/CWE-078/tst_shell-command-injection-from-environment.js#L6C14-L6C54)
   <pre><code class="javascript">(function() {
   	cp.execFileSync('rm',  ['-rf', path.join(__dirname, "temp")]); // GOOD
   	cp.execSync(<strong>'rm -rf ' + path.join(__dirname, "temp")</strong>); // BAD

   	execa.shell('rm -rf ' + path.join(__dirname, "temp")); // NOT OK
   </code></pre>

</details>

----------------------------------------

[javascript/ql/test/query-tests/Security/CWE-078/tst_shell-command-injection-from-environment.js](https://github.com/github/codeql/blob/48015e5a2e6202131f2d1062cc066dc33ed69a9b/javascript/ql/test/query-tests/Security/CWE-078/tst_shell-command-injection-from-environment.js#L8C14-L8C54)

<pre><code class="javascript">	cp.execSync('rm -rf ' + path.join(__dirname, "temp")); // BAD

	execa.shell(<strong>'rm -rf ' + path.join(__dirname, "temp")</strong>); // NOT OK
	execa.shellSync('rm -rf ' + path.join(__dirname, "temp")); // NOT OK

</code></pre>

*This shell command depends on an uncontrolled [absolute path](https://github.com/github/codeql/blob/48015e5a2e6202131f2d1062cc066dc33ed69a9b/javascript/ql/test/query-tests/Security/CWE-078/tst_shell-command-injection-from-environment.js#L8C36-L8C45).*

#### Paths

<details>
<summary>Path with 3 steps</summary>

1. [javascript/ql/test/query-tests/Security/CWE-078/tst_shell-command-injection-from-environment.js](https://github.com/github/codeql/blob/48015e5a2e6202131f2d1062cc066dc33ed69a9b/javascript/ql/test/query-tests/Security/CWE-078/tst_shell-command-injection-from-environment.js#L8C36-L8C45)
   <pre><code class="javascript">	cp.execSync('rm -rf ' + path.join(__dirname, "temp")); // BAD

   	execa.shell('rm -rf ' + path.join(<strong>__dirname</strong>, "temp")); // NOT OK
   	execa.shellSync('rm -rf ' + path.join(__dirname, "temp")); // NOT OK

   </code></pre>

2. [javascript/ql/test/query-tests/Security/CWE-078/tst_shell-command-injection-from-environment.js](https://github.com/github/codeql/blob/48015e5a2e6202131f2d1062cc066dc33ed69a9b/javascript/ql/test/query-tests/Security/CWE-078/tst_shell-command-injection-from-environment.js#L8C26-L8C54)
   <pre><code class="javascript">	cp.execSync('rm -rf ' + path.join(__dirname, "temp")); // BAD

   	execa.shell('rm -rf ' + <strong>path.join(__dirname, "temp")</strong>); // NOT OK
   	execa.shellSync('rm -rf ' + path.join(__dirname, "temp")); // NOT OK

   </code></pre>

3. [javascript/ql/test/query-tests/Security/CWE-078/tst_shell-command-injection-from-environment.js](https://github.com/github/codeql/blob/48015e5a2e6202131f2d1062cc066dc33ed69a9b/javascript/ql/test/query-tests/Security/CWE-078/tst_shell-command-injection-from-environment.js#L8C14-L8C54)
   <pre><code class="javascript">	cp.execSync('rm -rf ' + path.join(__dirname, "temp")); // BAD

   	execa.shell(<strong>'rm -rf ' + path.join(__dirname, "temp")</strong>); // NOT OK
   	execa.shellSync('rm -rf ' + path.join(__dirname, "temp")); // NOT OK

   </code></pre>

</details>

----------------------------------------

[javascript/ql/test/query-tests/Security/CWE-078/tst_shell-command-injection-from-environment.js](https://github.com/github/codeql/blob/48015e5a2e6202131f2d1062cc066dc33ed69a9b/javascript/ql/test/query-tests/Security/CWE-078/tst_shell-command-injection-from-environment.js#L9C18-L9C58)

<pre><code class="javascript">
	execa.shell('rm -rf ' + path.join(__dirname, "temp")); // NOT OK
	execa.shellSync(<strong>'rm -rf ' + path.join(__dirname, "temp")</strong>); // NOT OK

	const safe = "\"" + path.join(__dirname, "temp") + "\"";
</code></pre>

*This shell command depends on an uncontrolled [absolute path](https://github.com/github/codeql/blob/48015e5a2e6202131f2d1062cc066dc33ed69a9b/javascript/ql/test/query-tests/Security/CWE-078/tst_shell-command-injection-from-environment.js#L9C40-L9C49).*

#### Paths

<details>
<summary>Path with 3 steps</summary>

1. [javascript/ql/test/query-tests/Security/CWE-078/tst_shell-command-injection-from-environment.js](https://github.com/github/codeql/blob/48015e5a2e6202131f2d1062cc066dc33ed69a9b/javascript/ql/test/query-tests/Security/CWE-078/tst_shell-command-injection-from-environment.js#L9C40-L9C49)
   <pre><code class="javascript">
   	execa.shell('rm -rf ' + path.join(__dirname, "temp")); // NOT OK
   	execa.shellSync('rm -rf ' + path.join(<strong>__dirname</strong>, "temp")); // NOT OK

   	const safe = "\"" + path.join(__dirname, "temp") + "\"";
   </code></pre>

2. [javascript/ql/test/query-tests/Security/CWE-078/tst_shell-command-injection-from-environment.js](https://github.com/github/codeql/blob/48015e5a2e6202131f2d1062cc066dc33ed69a9b/javascript/ql/test/query-tests/Security/CWE-078/tst_shell-command-injection-from-environment.js#L9C30-L9C58)
   <pre><code class="javascript">
   	execa.shell('rm -rf ' + path.join(__dirname, "temp")); // NOT OK
   	execa.shellSync('rm -rf ' + <strong>path.join(__dirname, "temp")</strong>); // NOT OK

   	const safe = "\"" + path.join(__dirname, "temp") + "\"";
   </code></pre>

3. [javascript/ql/test/query-tests/Security/CWE-078/tst_shell-command-injection-from-environment.js](https://github.com/github/codeql/blob/48015e5a2e6202131f2d1062cc066dc33ed69a9b/javascript/ql/test/query-tests/Security/CWE-078/tst_shell-command-injection-from-environment.js#L9C18-L9C58)
   <pre><code class="javascript">
   	execa.shell('rm -rf ' + path.join(__dirname, "temp")); // NOT OK
   	execa.shellSync(<strong>'rm -rf ' + path.join(__dirname, "temp")</strong>); // NOT OK

   	const safe = "\"" + path.join(__dirname, "temp") + "\"";
   </code></pre>

</details>

----------------------------------------
