### github/codeql

[javascript/extractor/tests/regexp/input/multipart.js](https://github.com/github/codeql/blob/d094bbc06d063d0da8d0303676943c345e61de53/javascript/extractor/tests/regexp/input/multipart.js#L17C6-L20C6)

<pre><code class="javascript">
var bad95 = new RegExp(
    "<strong>(a" + </strong>
<strong>    "|" + </strong>
<strong>    "aa)*" + </strong>
<strong>    "</strong>b$"
);

</code></pre>

*This part of the regular expression may cause exponential backtracking on strings containing many repetitions of 'aa'.*

----------------------------------------
