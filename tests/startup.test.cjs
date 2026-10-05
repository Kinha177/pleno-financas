const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { EventEmitter } = require('node:events');

async function startup(lock = true) {
  const windows = []; const handlers = new Map(); const calls = [];
  const app = new EventEmitter();
  Object.assign(app, { setName() {}, requestSingleInstanceLock: () => lock, whenReady: () => Promise.resolve(), isReady: () => true, getPath: () => '/test-data', quit: () => calls.push('quit') });
  class Window extends EventEmitter {
    constructor(options) {
      super(); this.options = options; this.visible = options.show; this.minimized = false;
      this.webContents = new EventEmitter(); this.webContents.setWindowOpenHandler = () => {};
      windows.push(this);
    }
    loadFile() { return Promise.resolve(); }
    isDestroyed() { return false; }
    isMinimized() { return this.minimized; }
    restore() { this.minimized = false; }
    show() { this.visible = true; }
    focus() { this.focused = true; }
  }
  class Finance {
    constructor() { calls.push('database'); }
    snapshot(month) { calls.push('snapshot'); return { month }; }
    execute() { calls.push('execute'); }
    close() {}
  }
  const electron = { app, BrowserWindow: Window, Menu: { setApplicationMenu() {} }, session: { defaultSession: { setPermissionRequestHandler() {} } }, ipcMain: { handle: (name, fn) => handlers.set(name, fn) }, dialog: { showErrorBox() {} } };
  const directory = path.resolve(__dirname, '../src/main');
  vm.runInNewContext(fs.readFileSync(path.join(directory, 'main.cjs'), 'utf8'), {
    __dirname: directory, process: { platform: 'win32' }, console: { error() {} },
    require: name => name === 'electron' ? electron : name === './finance.cjs' ? { Finance, FinanceError: Error } : require(name)
  });
  await new Promise(resolve => setImmediate(resolve));
  return { app, windows, handlers, calls, directory };
}

test('janela aparece sem depender do evento ready-to-show', async () => {
  const { windows } = await startup();
  assert.equal(windows.length, 1); assert.equal(windows[0].visible, true);
});
test('segundo clique mostra janela oculta e restaura janela minimizada', async () => {
  const { app, windows } = await startup(); const window = windows[0];
  window.visible = false; window.minimized = true;
  app.emit('second-instance');
  assert.equal(window.visible, true); assert.equal(window.minimized, false); assert.equal(window.focused, true);
  assert.equal(windows.length, 1);
});
test('reativação recria a janela quando a anterior já foi fechada', async () => {
  const { app, windows } = await startup(); windows[0].emit('closed'); app.emit('activate');
  assert.equal(windows.length, 2); assert.equal(windows[1].visible, true);
});
test('segunda instância não abre outra conexão com o banco', async () => {
  const { calls, windows } = await startup(false);
  assert.deepEqual(calls, ['quit']); assert.equal(windows.length, 0);
});
test('IPC aceita apenas o frame principal da página local', async () => {
  const { handlers, calls, directory } = await startup();
  const snapshot = handlers.get('finance:snapshot');
  const frame = { url: pathToFileURL(path.join(directory, '../renderer/index.html')).href };
  const valid = await snapshot({ senderFrame: frame, sender: { mainFrame: frame } }, '2026-09'); assert.equal(valid.ok, true);
  const foreign = { url: 'https://example.com/' };
  const invalid = await snapshot({ senderFrame: foreign, sender: { mainFrame: foreign } }, '2026-09'); assert.equal(invalid.ok, false);
  const subframe = await snapshot({ senderFrame: { ...frame }, sender: { mainFrame: frame } }, '2026-09'); assert.equal(subframe.ok, false);
  assert.equal(calls.filter(c => c === 'snapshot').length, 1);
});
