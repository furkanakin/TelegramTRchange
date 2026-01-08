import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { spawn, execSync, exec } from 'child_process';

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

ipcMain.handle('get-coordinates', async () => {
  // Görünür pencereyi küçült ki kullanıcı arkadaki butona tıklayabilsin
  mainWindow.minimize();

  const script = `
    Add-Type -AssemblyName System.Windows.Forms
    while (!([System.Windows.Forms.Control]::MouseButtons -band [System.Windows.Forms.MouseButtons]::Left)) { 
      Start-Sleep -m 50 
    }
    $pos = [System.Windows.Forms.Control]::MousePosition
    Write-Output "$($pos.X),$($pos.Y)"
  `;

  try {
    const output = execSync(`powershell -Command "${script}"`).toString().trim();
    mainWindow.restore(); // Geri getir
    const [x, y] = output.split(',').map(Number);
    return { x, y };
  } catch (e) {
    mainWindow.restore();
    console.error('Coord capture error:', e);
    return null;
  }
});

ipcMain.on('close-app', () => { app.quit(); });
ipcMain.on('minimize-app', () => { mainWindow.minimize(); });

let isRunning = false;

ipcMain.handle('start-macro', async (event, { rootDir, clickX, clickY, waitTimeout }) => {
  if (isRunning) return { success: false, message: 'Macro zaten çalışıyor.' };
  isRunning = true;

  try {
    const folders = fs.readdirSync(rootDir).filter(f => {
      const fullPath = path.join(rootDir, f);
      return fs.statSync(fullPath).isDirectory() && /^\d+$/.test(f);
    });

    event.sender.send('log', `${folders.length} hesap bulundu.`);

    for (const folderName of folders) {
      if (!isRunning) break;

      const folderPath = path.join(rootDir, folderName);
      const exePath = path.join(folderPath, 'Telegram.exe');

      if (!fs.existsSync(exePath)) {
        event.sender.send('log', `${folderName}: Exe bulunamadı.`);
        continue;
      }

      event.sender.send('log', `${folderName} başlatılıyor...`);
      spawn(exePath, [], { cwd: folderPath, detached: true, stdio: 'ignore' }).unref();

      // Belirtilen süre kadar bekle ve tıkla
      await new Promise(r => setTimeout(r, waitTimeout * 1000));

      event.sender.send('log', `${folderName}: Koordinata tıklanıyor (${clickX}, ${clickY})...`);
      powershell.click(clickX, clickY);

      event.sender.send('log', `${folderName}: Yeniden açılma bekleniyor...`);
      const restarted = await waitForProcessRestart('Telegram.exe', 30000);

      if (restarted) {
        event.sender.send('log', `${folderName}: Yeniden açıldı, 2s bekleniyor...`);
        await new Promise(r => setTimeout(r, 2000));
        await killProcess('Telegram.exe');
      }

      await new Promise(r => setTimeout(r, 1000));
    }

    isRunning = false;
    return { success: true, message: 'İşlemler bitti.' };
  } catch (error) {
    isRunning = false;
    return { success: false, message: `Hata: ${error.message}` };
  }
});

ipcMain.on('stop-macro', () => { isRunning = false; });

async function waitForProcessRestart(exeName, timeoutMs) {
  const start = Date.now();
  // Önce kapanmasını bekle (opsiyonel ama daha sağlıklı)
  while (Date.now() - start < 10000) {
    const alive = await checkIfProcessRunning(exeName);
    if (!alive) break;
    await new Promise(r => setTimeout(r, 500));
  }
  // Sonra tekrar açılmasını bekle
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
