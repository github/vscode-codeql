const cp = require('child_process');

export function packageExtension() {
  const proc = cp.exec('vsce package');
  proc.stdout.on('data', (data) => {
    console.log(data.toString());
  });
  proc.stderr.on('data', (data) => {
    console.log(data.toString());
  });
  proc.on('exit', (code) => {
    console.log(`Exited with code: ${code}`);
  });

  return proc;
}
