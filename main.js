import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { spawn, exec } from 'child_process';
import robot from 'robotjs';
import Jimp from 'jimp';

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

  // development mode check
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

ipcMain.on('close-app', () => {
  app.quit();
});

ipcMain.on('minimize-app', () => {
  mainWindow.minimize();
});

// Macro Logic
let isRunning = false;

ipcMain.handle('start-macro', async (event, { rootDir, referenceImage }) => {
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

      const child = spawn(exePath, [], { cwd: folderPath, detached: true, stdio: 'ignore' });
      child.unref();

      // Wait for window and find button
      const found = await findAndClickButton(referenceImage, event.sender);

      if (found) {
        event.sender.send('log', `${folderName}: Buton bulundu ve tıklandı. Yeniden açılma bekleniyor...`);
        // Wait for Telegram to close and reopen
        const restarted = await waitForProcessRestart('Telegram.exe', 30000);
        if (restarted) {
          event.sender.send('log', `${folderName}: Yeniden açıldı, 2 saniye bekleniyor...`);
          await new Promise(r => setTimeout(r, 2000));
          await killProcess('Telegram.exe');
          event.sender.send('log', `${folderName}: İşlem tamamlandı.`);
        } else {
          event.sender.send('log', `${folderName}: Yeniden açılma zaman aşımına uğradı.`);
        }
      } else {
        event.sender.send('log', `${folderName}: 7 saniye içinde buton bulunamadı. Kapatılıyor...`);
        await killProcess('Telegram.exe');
      }

      await new Promise(r => setTimeout(r, 1000));
    }

    isRunning = false;
    return { success: true, message: 'Tüm işlemler tamamlandı.' };
  } catch (error) {
    isRunning = false;
    return { success: false, message: `Hata: ${error.message}` };
  }
});

ipcMain.on('stop-macro', () => {
  isRunning = false;
});

async function findAndClickButton(refImagePath, logger) {
  const startTime = Date.now();
  const timeout = 7000;
  let refImage;

  try {
    refImage = await Jimp.read(refImagePath);
  } catch (e) {
    console.error("Referans görsel okunamadı", e);
    return false;
  }

  while (Date.now() - startTime < timeout) {
    if (!isRunning) return false;

    try {
      const screen = robot.screen.capture();
      // Optimized conversion: only create Jimp once or use a smaller buffer
      // However, robotjs images are not standard buffers for Jimp.
      // We will use robotjs.getPixelColor as a fallback if this is too slow.

      const screenshot = new Jimp(screen.width, screen.height);
      screenshot.bitmap.data = Buffer.from(screen.image);

      // RobotJS returns BGRA on most platforms, Jimp expects RGBA.
      // Swap B and R
      for (let i = 0; i < screenshot.bitmap.data.length; i += 4) {
        let b = screenshot.bitmap.data[i];
        let r = screenshot.bitmap.data[i + 2];
        screenshot.bitmap.data[i] = r;
        screenshot.bitmap.data[i + 2] = b;
      }

      const pos = findSubImage(screenshot, refImage);
      if (pos) {
        robot.moveMouse(pos.x + refImage.bitmap.width / 2, pos.y + refImage.bitmap.height / 2);
        robot.mouseClick();
        return true;
      }
    } catch (e) {
      console.error("Ekran yakalama hatası", e);
    }

    await new Promise(r => setTimeout(r, 500));
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

  for (let y = 0; y <= baseH - subH; y += 10) {
    for (let x = 0; x <= baseW - subW; x += 10) {
      if (matchAt(x, y)) {
        return { x, y };
      }
    }
  }

  function matchAt(tx, ty) {
    const samples = [
      [0, 0], [subW - 1, 0], [0, subH - 1], [subW - 1, subH - 1],
      [Math.floor(subW / 2), Math.floor(subH / 2)]
    ];
    for (const [sx, sy] of samples) {
      const bi = ((ty + sy) * baseW + (tx + sx)) * 4;
      const si = (sy * subW + sx) * 4;
      if (Math.abs(baseData[bi] - subData[si]) > 40 ||
        Math.abs(baseData[bi + 1] - subData[si + 1]) > 40 ||
        Math.abs(baseData[bi + 2] - subData[si + 2]) > 40) {
        return false;
      }
    }
    return true;
  }

  return null;
}

async function waitForProcessRestart(exeName, timeoutMs) {
  const start = Date.now();
  // Wait for process to disappear first
  while (Date.now() - start < timeoutMs) {
    const alive = await checkIfProcessRunning(exeName);
    if (!alive) break;
    await new Promise(r => setTimeout(r, 500));
  }

  // Wait for it to reappear
  while (Date.now() - start < timeoutMs) {
    const alive = await checkIfProcessRunning(exeName);
    if (alive) return true;
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}

function checkIfProcessRunning(exeName) {
  return new Promise(resolve => {
    const cmd = `tasklist /FI "IMAGENAME eq ${exeName}"`;
    exec(cmd, (err, stdout) => {
      resolve(stdout.toLowerCase().includes(exeName.toLowerCase()));
    });
  });
}

function killProcess(exeName) {
  return new Promise(resolve => {
    const cmd = `taskkill /F /IM ${exeName}`;
    exec(cmd, () => resolve());
  });
}
