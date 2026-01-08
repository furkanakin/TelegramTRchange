import os
import subprocess
import time
import psutil
import pyautogui

class TelegramAutomator:
    def __init__(self, root_dir, delay_seconds, click_coords):
        self.root_dir = root_dir
        self.delay_seconds = delay_seconds
        self.click_coords = click_coords # (x, y)
        self.running = False

    def get_account_folders(self):
        """Sayısal isimli klasörleri listeler."""
        folders = [f for f in os.listdir(self.root_dir) if os.path.isdir(os.path.join(self.root_dir, f)) and f.isdigit()]
        return sorted(folders)

    def is_process_running(self, process_name="Telegram.exe"):
        """Sürecin çalışıp çalışmadığını kontrol eder."""
        for proc in psutil.process_iter(['name']):
            if proc.info['name'].lower() == process_name.lower():
                return proc
        return None

    def kill_telegram(self):
        """Tüm Telegram süreçlerini sonlandırır."""
        for proc in psutil.process_iter(['name']):
            if proc.info['name'].lower() == "telegram.exe":
                try:
                    proc.kill()
                except:
                    pass
        time.sleep(1)

    def run_macro(self, status_callback):
        self.running = True
        accounts = self.get_account_folders()
        
        for account in accounts:
            if not self.running:
                break
            
            acc_path = os.path.join(self.root_dir, account)
            exe_path = os.path.join(acc_path, "Telegram.exe")
            
            if not os.path.exists(exe_path):
                status_callback(f"Atlanıyor: {account} (Exe bulunamadı)")
                continue

            status_callback(f"İşleniyor: {account}...")
            
            # 1. Telegram'ı aç
            subprocess.Popen([exe_path], cwd=acc_path)
            
            # 2. Belirlenen süre kadar bekle
            status_callback(f"{account}: {self.delay_seconds} sn bekleniyor...")
            time.sleep(self.delay_seconds)
            
            # 3. Change butonuna tıkla
            if self.click_coords:
                status_callback(f"{account}: Tıklanıyor {self.click_coords}")
                pyautogui.click(self.click_coords[0], self.click_coords[1])
            
            # 4. Yeniden açılmayı bekle
            # Tıklamadan sonra Telegram kapanır.
            status_callback(f"{account}: Yeniden başlatma bekleniyor...")
            
            # Kapanmasını bekle (max 10 sn)
            for _ in range(20):
                if not self.is_process_running():
                    break
                time.sleep(0.5)
            
            # Tekrar açılmasını bekle
            found = False
            for _ in range(60): # Max 30 sn bekleme
                if self.is_process_running():
                    found = True
                    break
                time.sleep(0.5)
            
            if found:
                status_callback(f"{account}: Dil değişti, 2 sn sonra kapatılıyor.")
                time.sleep(2)
                self.kill_telegram()
            else:
                status_callback(f"{account}: Yeniden açılma algılanamadı.")
            
            time.sleep(1)

        self.running = False
        status_callback("Tüm işlemler tamamlandı.")

    def stop(self):
        self.running = False
