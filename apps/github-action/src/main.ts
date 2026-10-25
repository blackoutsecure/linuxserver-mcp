import { runAction } from './index.js';

void runAction(process.env, (text) => {
  process.stdout.write(text);
}).then(
  (code) => {
    process.exitCode = code;
  },
  () => {
    process.stderr.write(
      'LinuxServer MCP: INTERNAL_ERROR in the Action runner.\n'
    );
    process.exitCode = 2;
  }
);
