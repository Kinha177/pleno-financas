const { app, BrowserWindow, Menu, session, ipcMain, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { Finance, FinanceError } = require('./finance.cjs');
let finance;
let mainWindow;
const entry = path.join(__dirname, '../renderer/index.html');

function handle(channel, operation) {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      if (!event.senderFrame || event.senderFrame !== event.sender.mainFrame || event.senderFrame.url.split('#')[0] !== pathToFileURL(entry).href) throw new FinanceError('Origem não autorizada.');
      return { ok: true, data: await operation(...args) };
    } catch (error) {
      console.error(channel, error);
      let message = error instanceof FinanceError ? error.message : 'Não foi possível concluir a operação. Seus dados anteriores foram preservados.';
      if (/UNIQUE constraint/.test(error.message)) message = 'Já existe um registro com esse nome ou competência.';
      if (/database is locked/.test(error.message)) message = 'O banco está ocupado. Tente novamente em instantes.';
      return { ok: false, error: message };
    }
  });
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1000,
    minHeight: 720,
    backgroundColor: '#f5f6f3',
    title: 'Pleno • Suas finanças, com clareza',
    icon: path.join(__dirname, '../../build/icon.png'),
    show: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true }
  });
  mainWindow = window;
  window.on('closed', () => { if (mainWindow === window) mainWindow = null; });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.on('preload-error', (_event, _file, error) => console.error('Falha ao iniciar a ponte local:', error));
  window.loadFile(entry).catch(error => { dialog.showErrorBox('Não foi possível abrir a interface', error.message); app.quit(); });
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) createWindow();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

app.setName('Pleno');
if (!app.requestSingleInstanceLock()) app.quit();
else {
app.on('second-instance', () => { if (app.isReady() && finance) showMainWindow(); });
app.whenReady().then(() => {
  try {
    finance = new Finance(path.join(app.getPath('userData'), 'financeiro.db'));
    handle('finance:snapshot', month => finance.snapshot(month));
    handle('finance:execute', (action, payload) => finance.execute(action, payload));
    handle('finance:backup', async () => {
      const result = await dialog.showSaveDialog({ title: 'Salvar cópia de segurança', defaultPath: `pleno-backup-${new Date().toISOString().slice(0, 10)}.db`, filters: [{ name: 'Banco SQLite', extensions: ['db'] }] });
      if (result.canceled) return null;
      // VACUUM INTO exige um arquivo novo; não substitui bancos existentes.
      if (fs.existsSync(result.filePath)) throw new FinanceError('Esse arquivo já existe. Escolha um nome novo para a cópia de segurança.');
      finance.backup(result.filePath); return result.filePath;
    });
  } catch (error) { dialog.showErrorBox('Não foi possível abrir o banco', error.message); app.quit(); return; }
  Menu.setApplicationMenu(null);
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  createWindow();
  app.on('activate', showMainWindow);
});
}
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('will-quit', () => { if (finance) finance.close(); });
