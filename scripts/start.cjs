const { spawn } = require('node:child_process');
const path = require('node:path');
// Alguns terminais de IDE herdam esse modo do próprio editor Electron.
// Remover apenas do processo filho garante a inicialização como aplicativo.
const environment = { ...process.env };
delete environment.ELECTRON_RUN_AS_NODE;
// Este processo é a janela interativa solicitada pelo usuário, não um helper.
const child = spawn(require('electron'), [path.join(__dirname, '..')], { env: environment, stdio: 'inherit', windowsHide: false });
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
