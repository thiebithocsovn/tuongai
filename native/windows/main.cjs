'use strict';
const { app, BrowserWindow, shell, dialog } = require('electron');
const path = require('node:path');
const HOME = 'https://thiebithocsovn.github.io/tuongai/';

function isOfficial(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.hostname === 'thiebithocsovn.github.io'
      && (u.pathname === '/tuongai' || u.pathname.startsWith('/tuongai/'));
  } catch { return false; }
}
async function openExternal(url) {
  try {
    const u = new URL(url);
    if (u.protocol === 'https:' || u.protocol === 'mailto:') await shell.openExternal(url);
  } catch {}
}
function createWindow() {
  const win = new BrowserWindow({
    width: 1220, height: 820, minWidth: 375, minHeight: 540,
    title: 'Tường học tập AI – Truy gốc lỗi',
    autoHideMenuBar: true,
    backgroundColor: '#f5f8fb',
    icon: app.isPackaged
      ? path.join(process.resourcesPath, 'icon.png')
      : path.join(__dirname, '../../icon-512.png'),
    webPreferences: {
      sandbox: true,
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true
    }
  });
  const ses = win.webContents.session;
  ses.setPermissionRequestHandler((contents, permission, callback, details) => {
    const url = details.requestingUrl || contents.getURL();
    // Camera permission only for the official learning site, not third parties.
    let sameOrigin = false;
    try { sameOrigin = new URL(url).origin === new URL(HOME).origin; } catch {}
    callback(permission === 'media' && isOfficial(contents.getURL()) && sameOrigin);
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (!isOfficial(url)) {
      event.preventDefault();
      openExternal(url);
    }
  });
  win.webContents.on('did-fail-load', async (event, code, message, url, isMainFrame) => {
    if (code === -3 || !isMainFrame) return;
    const result = await dialog.showMessageBox(win, {
      type: 'warning', buttons: ['Thử kết nối lại', 'Đóng'],
      defaultId: 0, cancelId: 1,
      title: 'Chưa kết nối được Tường học tập AI',
      message: 'Không mở được trang web chính thức.',
      detail: 'Hãy kiểm tra Internet và thử kết nối lại. (' + String(code) + ')'
    });
    if (result.response === 0 && !win.isDestroyed()) win.loadURL(HOME);
  });
  win.loadURL(HOME);
}
app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
