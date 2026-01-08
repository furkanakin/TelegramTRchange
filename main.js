import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { spawn, execSync, exec } from 'child_process';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { Jimp } = require('jimp');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Windows Native Utils via PowerShell
const powershell = {
  screenshot: (outputPath) => {
    const script = `
      Add-Type -AssemblyName System.Windows.Forms
      Add-Type -AssemblyName System.Drawing
      $Screen = [System.Windows.Forms.Screen]::PrimaryScreen
      $Width  = $Screen.Bounds.Width
      $Height = $Screen.Bounds.Height
      $Left   = $Screen.Bounds.Left
      $Top    = $Screen.Bounds.Top
      $Bitmap = New-Object System.Drawing.Bitmap $Width, $Height
      $Graphic = [System.Drawing.Graphics]::FromImage($Bitmap)
      $Graphic.CopyFromScreen($Left, $Top, 0, 0, $Bitmap.Size)
      $Bitmap.Save('${outputPath}', [System.Drawing.Imaging.ImageFormat]::Png)
      $Graphic.Dispose()
      $Bitmap.Dispose()
    `;
    try {
      execSync(`powershell -Command "${script.replace(/\n/g, '')}"`);
      return true;
    } catch (e) {
      console.error('Screenshot error:', e);
      return false;
    }
  },
  click: (x, y) => {
    const script = `
      Add-Type -TypeDefinition @'
      using System;
      using System.Runtime.InteropServices;
      public class Mouse {
          [DllImport("user32.dll")]
          public static extern void mouse_event(int dwFlags, int dx, int dy, int cButtons, int dwExtraInfo);
          [DllImport("user32.dll")]
          public static extern bool SetCursorPos(int x, int y);
      }
'@
      [Mouse]::SetCursorPos(${Math.floor(x)}, ${Math.floor(y)})
      [Mouse]::mouse_event(0x0002, 0, 0, 0, 0)
      [Mouse]::mouse_event(0x0004, 0, 0, 0, 0)
    `;
    try {
      execSync(`powershell -Command "${script}"`);
    } catch (e) {
      console.error('Click error:', e);
    }
  }
};

// IPC Handlers
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });
  return result.filePaths[0];
});

ipcMain.handle('select-image', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['jpg', 'png', 'jpeg'] }],
  });
  return result.filePaths[0];
});

ipcMain.on('close-app', () => { app.quit(); });
ipcMain.on('minimize-app', () => { mainWindow.minimize(); });

let isRunning = false;

ipcMain.handle('start-macro', async (event, { rootDir, referenceImage, waitTimeout }) => {
  if (isRunning) return { success: false, message: 'Macro zaten çalışıyor.' };
  isRunning = true;

  try {
    const folders = fs.readdirSync(rootDir).filter(f => {
      const fullPath = path.join(rootDir, f);
      return fs.statSync(fullPath).isDirectory() && /^\d+$/.test(f);
    });

    event.sender.send('log', `${folders.length} adet hesap klasörü bulundu.`);

    for (const folderName of folders) {
      if (!isRunning) break;

      const folderPath = path.join(rootDir, folderName);
      const exePath = path.join(folderPath, 'Telegram.exe');

      if (!fs.existsSync(exePath)) {
        event.sender.send('log', `Hata: ${folderName} içinde Telegram.exe bulunamadı.`);
        continue;
      }

      event.sender.send('log', `${folderName} başlatılıyor...`);
      spawn(exePath, [], { cwd: folderPath, detached: true, stdio: 'ignore' }).unref();

      const found = await findAndClickButton(referenceImage, event.sender, waitTimeout);

      if (found) {
        event.sender.send('log', `${folderName}: Buton tıklandı. Yeniden açılma bekleniyor...`);
        const restarted = await waitForProcessRestart('Telegram.exe', 30000);
        if (restarted) {
          event.sender.send('log', `${folderName}: Yeniden açıldı, 2s bekleniyor...`);
          await new Promise(r => setTimeout(r, 2000));
          await killProcess('Telegram.exe');
        }
      } else {
        event.sender.send('log', `${folderName}: Buton bulunamadı. Kapatılıyor...`);
        await killProcess('Telegram.exe');
      }

      await new Promise(r => setTimeout(r, 1000));
    }

    isRunning = false;
    return { success: true, message: 'İşlemler tamamlandı.' };
  } catch (error) {
    isRunning = false;
    return { success: false, message: `Hata: ${error.message}` };
  }
});

ipcMain.on('stop-macro', () => { isRunning = false; });

async function findAndClickButton(refImagePath, logger, waitTimeout) {
  const startTime = Date.now();
  const timeout = (waitTimeout || 7) * 1000;
  let refImage = await Jimp.read(refImagePath);
  const tempPath = path.join(app.getPath('temp'), 'tg_macro_snap.png');

  while (Date.now() - startTime < timeout) {
    if (!isRunning) return false;

    if (powershell.screenshot(tempPath)) {
      try {
        const screenshot = await Jimp.read(tempPath);
        const pos = findSubImage(screenshot, refImage);
        if (pos) {
          powershell.click(pos.x + refImage.bitmap.width / 2, pos.y + refImage.bitmap.height / 2);
          return true;
        }
      } catch (e) {
        console.error('Find image error:', e);
      }
    }
    await new Promise(r => setTimeout(r, 700));
  }
  return false;
}

function findSubImage(base, sub) {
  const baseW = base.bitmap.width;
  const baseH = base.bitmap.height;
  const subW = sub.bitmap.width;
  const subH = sub.bitmap.height;
  const baseData = base.bitmap.data;
  const subData = sub.bitmap.data;

  for (let y = 0; y <= baseH - subH; y += 8) {
    for (let x = 0; x <= baseW - subW; x += 8) {
      if (matchAt(x, y)) return { x, y };
    }
  }

  function matchAt(tx, ty) {
    // Corner + center samples
    const samples = [[0, 0], [subW - 1, 0], [0, subH - 1], [subW - 1, subH - 1], [Math.floor(subW / 2), Math.floor(subH / 2)]];
    for (const [sx, sy] of samples) {
      const bi = ((ty + sy) * baseW + (tx + sx)) * 4;
      const si = (sy * subW + sx) * 4;
      if (Math.abs(baseData[bi] - subData[si]) > 40 || Math.abs(baseData[bi + 1] - subData[si + 1]) > 40 || Math.abs(baseData[bi + 2] - subData[si + 2]) > 40) return false;
    }
    return true;
  }
  return null;
}

async function waitForProcessRestart(exeName, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const alive = await checkIfProcessRunning(exeName);
    if (!alive) break;
    await new Promise(r => setTimeout(r, 500));
  }
  while (Date.now() - start < timeoutMs) {
    const alive = await checkIfProcessRunning(exeName);
    if (alive) return true;
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}

function checkIfProcessRunning(exeName) {
  return new Promise(resolve => {
    exec(`tasklist /FI "IMAGENAME eq ${exeName}"`, (err, stdout) => {
      resolve(stdout.toLowerCase().includes(exeName.toLowerCase()));
    });
  });
}

function killProcess(exeName) {
  return new Promise(resolve => {
    exec(`taskkill /F /IM ${exeName}`, () => resolve());
  });
}
