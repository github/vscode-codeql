### meteor/meteor

[packages/deprecated/markdown/showdown.js](https://github.com/meteor/meteor/blob/53f3c4442d3542d3d2a012a854472a0d1bef9d12/packages/deprecated/markdown/showdown.js#L415-L415)

<pre><code class="javascript">
		/g,hashElement);
	*/
	text = text.replace(/(\n\n[ ]{0,3}<!(--<strong>[^\r]*?</strong>--\s*)+>[ \t]*(?=\n{2,}))/g,hashElement);

	// PHP and ASP-style processor instructions (<?...?> and <%...%>)

</code></pre>

*This part of the regular expression may cause exponential backtracking on strings containing many repetitions of '----'.*

----------------------------------------

[packages/deprecated/markdown/showdown.js](https://github.com/meteor/meteor/blob/53f3c4442d3542d3d2a012a854472a0d1bef9d12/packages/deprecated/markdown/showdown.js#L523-L523)

<pre><code class="javascript">
	// Build a regex to find HTML tags and comments.  See Friedl's
	// "Mastering Regular Expressions", 2nd Ed., pp. 200-201.
	var regex = /(<[a-z\/!$]("[^"]*"|'[^']*'|[^'">])*>|<!(--<strong>.*?</strong>--\s*)+>)/gi;

	text = text.replace(regex, function(wholeMatch) {

</code></pre>

*This part of the regular expression may cause exponential backtracking on strings starting with '<!--' and containing many repetitions of '----'.*

----------------------------------------

[tools/tests/apps/modules/imports/links/acorn/src/parseutil.js](https://github.com/meteor/meteor/blob/53f3c4442d3542d3d2a012a854472a0d1bef9d12/tools/tests/apps/modules/imports/links/acorn/src/parseutil.js#L9-L9)

<pre><code class="javascript">
// ## Parser utilities

const literal = /^(?:'(<strong>(?:\\.|[^'])*?</strong>)'|"((?:\\.|[^"])*?)")/
pp.strictDirective = function(start) {
  for (;;) {

</code></pre>

*This part of the regular expression may cause exponential backtracking on strings starting with ''' and containing many repetitions of '\&'.*

----------------------------------------

[tools/tests/apps/modules/imports/links/acorn/src/parseutil.js](https://github.com/meteor/meteor/blob/53f3c4442d3542d3d2a012a854472a0d1bef9d12/tools/tests/apps/modules/imports/links/acorn/src/parseutil.js#L9-L9)

<pre><code class="javascript">
// ## Parser utilities

const literal = /^(?:'((?:\\.|[^'])*?)'|"(<strong>(?:\\.|[^"])*?</strong>)")/
pp.strictDirective = function(start) {
  for (;;) {

</code></pre>

*This part of the regular expression may cause exponential backtracking on strings starting with '"' and containing many repetitions of '\!'.*

----------------------------------------
