### meteor/meteor

[packages/deprecated/markdown/showdown.js](https://github.com/meteor/meteor/blob/53f3c4442d3542d3d2a012a854472a0d1bef9d12/packages/deprecated/markdown/showdown.js#L415-L415)

<pre><code class="javascript">		/g,hashElement);
	*/
	text = text.replace(/(\n\n[ ]{0,3}&lt;!(--<strong>[^\r]*?</strong>--\s*)+&gt;[ \t]*(?=\n{2,}))/g,hashElement);

	// PHP and ASP-style processor instructions (&lt;?...?&gt; and &lt;%...%&gt;)
</code></pre>

*This part of the regular expression may cause exponential backtracking on strings containing many repetitions of '----'.*

----------------------------------------

[packages/deprecated/markdown/showdown.js](https://github.com/meteor/meteor/blob/53f3c4442d3542d3d2a012a854472a0d1bef9d12/packages/deprecated/markdown/showdown.js#L523-L523)

<pre><code class="javascript">	// Build a regex to find HTML tags and comments.  See Friedl's
	// "Mastering Regular Expressions", 2nd Ed., pp. 200-201.
	var regex = /(&lt;[a-z\/!$]("[^"]*"|'[^']*'|[^'"&gt;])*&gt;|&lt;!(--<strong>.*?</strong>--\s*)+&gt;)/gi;

	text = text.replace(regex, function(wholeMatch) {
</code></pre>

*This part of the regular expression may cause exponential backtracking on strings starting with '<!--' and containing many repetitions of '----'.*

----------------------------------------

[tools/tests/apps/modules/imports/links/acorn/src/parseutil.js](https://github.com/meteor/meteor/blob/53f3c4442d3542d3d2a012a854472a0d1bef9d12/tools/tests/apps/modules/imports/links/acorn/src/parseutil.js#L9-L9)

<pre><code class="javascript">// ## Parser utilities

const literal = /^(?:'(<strong>(?:\\.|[^'])*?</strong>)'|"((?:\\.|[^"])*?)")/
pp.strictDirective = function(start) {
  for (;;) {
</code></pre>

*This part of the regular expression may cause exponential backtracking on strings starting with ''' and containing many repetitions of '\&'.*

----------------------------------------

[tools/tests/apps/modules/imports/links/acorn/src/parseutil.js](https://github.com/meteor/meteor/blob/53f3c4442d3542d3d2a012a854472a0d1bef9d12/tools/tests/apps/modules/imports/links/acorn/src/parseutil.js#L9-L9)

<pre><code class="javascript">const literal = /^(?:'((?:\\.|[^'])*?)'|"(<strong>(?:\\.|[^"])*?</strong>)")/</code></pre>

*This part of the regular expression may cause exponential backtracking on strings starting with '"' and containing many repetitions of '\!'.*

----------------------------------------

[app/src/main/AndroidManifest.xml](https://github.com/AlexRogalskiy/android-nrf-toolbox/blob/034cf3aa7d2a3a4145177de32546ca518a462a66/app/src/main/AndroidManifest.xml#L239-L249)

<pre><code class="javascript">		&lt;/service&gt;

		<strong>&lt;activity</strong>
<strong>			android:name="no.nordicsemi.android.nrftoolbox.dfu.DfuInitiatorActivity"</strong>
<strong>			android:label="@string/dfu_service_title"</strong>
<strong>			android:noHistory="true"</strong>
<strong>			android:theme="@style/AppTheme.Translucent" &gt;</strong>
<strong>			&lt;intent-filter&gt;</strong>
<strong>				&lt;action android:name="no.nordicsemi.android.action.DFU_UPLOAD" /&gt;</strong>
<strong></strong>
<strong>				&lt;category android:name="android.intent.category.DEFAULT" /&gt;</strong>
<strong>			&lt;/intent-filter&gt;</strong>
<strong>		&lt;/activity&gt;</strong>

		&lt;service
</code></pre>

*This component is implicitly exported.*

----------------------------------------
