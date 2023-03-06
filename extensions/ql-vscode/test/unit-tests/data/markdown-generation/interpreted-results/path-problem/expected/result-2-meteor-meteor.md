### meteor/meteor

[npm-packages/meteor-installer/install.js](https://github.com/meteor/meteor/blob/73b538fe201cbfe89dd0c709689023f9b3eab1ec/npm-packages/meteor-installer/install.js#L259-L259)

<pre><code class="javascript">  if (isWindows()) {
    //set for the current session and beyond
    child_process.execSync(<strong>`setx path "${meteorPath}/;%path%`</strong>);
    return;
  }
</code></pre>

*This shell command depends on an uncontrolled [absolute path](https://github.com/meteor/meteor/blob/73b538fe201cbfe89dd0c709689023f9b3eab1ec/npm-packages/meteor-installer/config.js#L39-L39).*

#### Paths

<details>
<summary>Path with 11 steps</summary>

1. [npm-packages/meteor-installer/config.js](https://github.com/meteor/meteor/blob/73b538fe201cbfe89dd0c709689023f9b3eab1ec/npm-packages/meteor-installer/config.js#L39-L39)
   <pre><code class="javascript">
   const meteorLocalFolder = '.meteor';
   const meteorPath = <strong>path.resolve(rootPath, meteorLocalFolder)</strong>;
   
   module.exports = {
   </code></pre>
   
2. [npm-packages/meteor-installer/config.js](https://github.com/meteor/meteor/blob/73b538fe201cbfe89dd0c709689023f9b3eab1ec/npm-packages/meteor-installer/config.js#L39-L39)
   <pre><code class="javascript">
   const meteorLocalFolder = '.meteor';
   const <strong>meteorPath = path.resolve(rootPath, meteorLocalFolder)</strong>;
   
   module.exports = {
   </code></pre>
   
3. [npm-packages/meteor-installer/config.js](https://github.com/meteor/meteor/blob/73b538fe201cbfe89dd0c709689023f9b3eab1ec/npm-packages/meteor-installer/config.js#L44-L44)
   <pre><code class="javascript">  METEOR_LATEST_VERSION,
     extractPath: rootPath,
     <strong>meteorPath</strong>,
     release: process.env.INSTALL_METEOR_VERSION || METEOR_LATEST_VERSION,
     rootPath,
   </code></pre>
   
4. [npm-packages/meteor-installer/install.js](https://github.com/meteor/meteor/blob/73b538fe201cbfe89dd0c709689023f9b3eab1ec/npm-packages/meteor-installer/install.js#L12-L12)
   <pre><code class="javascript">const os = require('os');
   const {
     <strong>meteorPath</strong>,
     release,
     startedPath,
   </code></pre>
   
5. [npm-packages/meteor-installer/install.js](https://github.com/meteor/meteor/blob/73b538fe201cbfe89dd0c709689023f9b3eab1ec/npm-packages/meteor-installer/install.js#L11-L23)
   <pre><code class="javascript">const tmp = require('tmp');
   const os = require('os');
   const <strong>{</strong>
   <strong>  meteorPath,</strong>
   <strong>  release,</strong>
   <strong>  startedPath,</strong>
   <strong>  extractPath,</strong>
   <strong>  isWindows,</strong>
   <strong>  rootPath,</strong>
   <strong>  sudoUser,</strong>
   <strong>  isSudo,</strong>
   <strong>  isMac,</strong>
   <strong>  METEOR_LATEST_VERSION,</strong>
   <strong>  shouldSetupExecPath,</strong>
   <strong>} = require('./config.js')</strong>;
   const { uninstall } = require('./uninstall');
   const {
   </code></pre>
   
6. [npm-packages/meteor-installer/install.js](https://github.com/meteor/meteor/blob/73b538fe201cbfe89dd0c709689023f9b3eab1ec/npm-packages/meteor-installer/install.js#L259-L259)
   <pre><code class="javascript">  if (isWindows()) {
       //set for the current session and beyond
       child_process.execSync(`setx path "${<strong>meteorPath</strong>}/;%path%`);
       return;
     }
   </code></pre>
   
7. [npm-packages/meteor-installer/install.js](https://github.com/meteor/meteor/blob/73b538fe201cbfe89dd0c709689023f9b3eab1ec/npm-packages/meteor-installer/install.js#L259-L259)
   <pre><code class="javascript">  if (isWindows()) {
       //set for the current session and beyond
       child_process.execSync(`setx path "${<strong>meteorPath</strong>}/;%path%`);
       return;
     }
   </code></pre>
   
8. [npm-packages/meteor-installer/install.js](https://github.com/meteor/meteor/blob/73b538fe201cbfe89dd0c709689023f9b3eab1ec/npm-packages/meteor-installer/install.js#L259-L259)
   <pre><code class="javascript">  if (isWindows()) {
       //set for the current session and beyond
       child_process.execSync(`setx path "${<strong>meteorPath</strong>}/;%path%`);
       return;
     }
   </code></pre>
   
9. [npm-packages/meteor-installer/install.js](https://github.com/meteor/meteor/blob/73b538fe201cbfe89dd0c709689023f9b3eab1ec/npm-packages/meteor-installer/install.js#L259-L259)
   <pre><code class="javascript">  if (isWindows()) {
       //set for the current session and beyond
       child_process.execSync(`setx path "${<strong>meteorPath</strong>}/;%path%`);
       return;
     }
   </code></pre>
   
10. [npm-packages/meteor-installer/install.js](https://github.com/meteor/meteor/blob/73b538fe201cbfe89dd0c709689023f9b3eab1ec/npm-packages/meteor-installer/install.js#L259-L259)
    <pre><code class="javascript">  if (isWindows()) {
        //set for the current session and beyond
        child_process.execSync(`setx path "${<strong>meteorPath</strong>}/;%path%`);
        return;
      }
    </code></pre>
    
11. [npm-packages/meteor-installer/install.js](https://github.com/meteor/meteor/blob/73b538fe201cbfe89dd0c709689023f9b3eab1ec/npm-packages/meteor-installer/install.js#L259-L259)
    <pre><code class="javascript">  if (isWindows()) {
        //set for the current session and beyond
        child_process.execSync(<strong>`setx path "${meteorPath}/;%path%`</strong>);
        return;
      }
    </code></pre>
    

</details>

<details>
<summary>Path with 2 steps</summary>

1. [npm-packages/meteor-installer/config.js](https://github.com/meteor/meteor/blob/73b538fe201cbfe89dd0c709689023f9b3eab1ec/npm-packages/meteor-installer/config.js#L39-L39)
   <pre><code class="javascript">
   const meteorLocalFolder = '.meteor';
   const meteorPath = <strong>path.resolve(rootPath, meteorLocalFolder)</strong>;
   
   module.exports = {
   </code></pre>
   
2. [npm-packages/meteor-installer/install.js](https://github.com/meteor/meteor/blob/73b538fe201cbfe89dd0c709689023f9b3eab1ec/npm-packages/meteor-installer/install.js#L259-L259)
   <pre><code class="javascript">  if (isWindows()) {
       //set for the current session and beyond
       child_process.execSync(<strong>`setx path "${meteorPath}/;%path%`</strong>);
       return;
     }
   </code></pre>
   

</details>

----------------------------------------
