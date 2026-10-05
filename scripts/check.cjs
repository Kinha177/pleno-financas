const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(filename);
    else if (/\.(c?js)$/.test(entry.name)) { execFileSync(process.execPath, ['--check', filename], { stdio: 'inherit' }); console.log('OK', filename); }
  }
}
walk('src'); walk('scripts'); walk('tests');
