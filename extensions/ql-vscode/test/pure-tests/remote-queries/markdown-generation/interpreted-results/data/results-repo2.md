### meteor/meteor

[npm-packages/meteor-installer/install.js](https://github.com/meteor/meteor/blob/73b538fe201cbfe89dd0c709689023f9b3eab1ec/npm-packages/meteor-installer/install.js#L259-L259)

```javascript
  if (isWindows()) {
    //set for the current session and beyond
    child_process.execSync(`setx path "${meteorPath}/;%path%`);
    return;
  }

```

This shell command depends on an uncontrolled [absolute path](https://github.com/meteor/meteor/blob/73b538fe201cbfe89dd0c709689023f9b3eab1ec/npm-packages/meteor-installer/config.js#L39-L39).

----------------------------------------
