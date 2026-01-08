import tkinter as tk
import customtkinter as ctk
from tkinter import filedialog
from automation import TelegramAutomator
import threading
import json
import os
import pyautogui
import time

ctk.set_appearance_mode("Dark")
ctk.set_default_color_theme("blue")

class App(ctk.CTk):
    def __init__(self):
        super().__init__()

        self.title("Telegram TR Dil Değiştirici")
        self.geometry("600x500")

        self.config_path = "config.json"
        self.load_config()

        self.automator = None
        self.coords = self.saved_config.get("coords", None)

        # UI Elemanları
        self.grid_columnconfigure(0, weight=1)
        
        # Başlık
        self.label_title = ctk.CTkLabel(self, text="Telegram Dil Değiştirici", font=ctk.CTkFont(size=24, weight="bold"))
        self.label_title.grid(row=0, column=0, padx=20, pady=(20, 10))

        # Klasör Seçimi
        self.frame_folder = ctk.CTkFrame(self)
        self.frame_folder.grid(row=1, column=0, padx=20, pady=10, sticky="ew")
        self.frame_folder.grid_columnconfigure(0, weight=1)

        self.entry_folder = ctk.CTkEntry(self.frame_folder, placeholder_text="Telegram Ana Klasörünü Seçin")
        self.entry_folder.insert(0, self.saved_config.get("folder", ""))
        self.entry_folder.grid(row=0, column=0, padx=(10, 5), pady=10, sticky="ew")

        self.btn_browse = ctk.CTkButton(self.frame_folder, text="Klasör Seç", width=100, command=self.browse_folder)
        self.btn_browse.grid(row=0, column=1, padx=(5, 10), pady=10)

        # Ayarlar (Gecikme ve Koordinat)
        self.frame_settings = ctk.CTkFrame(self)
        self.frame_settings.grid(row=2, column=0, padx=20, pady=10, sticky="ew")
        self.frame_settings.grid_columnconfigure((0, 1), weight=1)

        self.label_delay = ctk.CTkLabel(self.frame_settings, text="Bekleme Süresi (Saniye):")
        self.label_delay.grid(row=0, column=0, padx=10, pady=(10, 0), sticky="w")
        
        self.entry_delay = ctk.CTkEntry(self.frame_settings)
        self.entry_delay.insert(0, str(self.saved_config.get("delay", 5)))
        self.entry_delay.grid(row=1, column=0, padx=10, pady=(0, 10), sticky="ew")

        self.btn_coords = ctk.CTkButton(self.frame_settings, text="Koordinat Belirle", command=self.start_coord_picker)
        self.btn_coords.grid(row=1, column=1, padx=10, pady=(0, 10), sticky="ew")
        
        self.label_coords_val = ctk.CTkLabel(self.frame_settings, text=f"Koordinat: {self.coords if self.coords else 'Belirlenmedi'}")
        self.label_coords_val.grid(row=0, column=1, padx=10, pady=(10, 0))

        # Durum ve Log
        self.textbox_log = ctk.CTkTextbox(self, height=150)
        self.textbox_log.grid(row=3, column=0, padx=20, pady=10, sticky="nsew")
        self.grid_rowconfigure(3, weight=1)

        # Başlat/Durdur Butonları
        self.frame_actions = ctk.CTkFrame(self, fg_color="transparent")
        self.frame_actions.grid(row=4, column=0, padx=20, pady=20, sticky="ew")
        self.frame_actions.grid_columnconfigure((0, 1), weight=1)

        self.btn_start = ctk.CTkButton(self.frame_actions, text="BAŞLAT", fg_color="green", hover_color="darkgreen", command=self.start_automation)
        self.btn_start.grid(row=0, column=0, padx=10, pady=0, sticky="ew")

        self.btn_stop = ctk.CTkButton(self.frame_actions, text="DURDUR", fg_color="red", hover_color="darkred", state="disabled", command=self.stop_automation)
        self.btn_stop.grid(row=0, column=1, padx=10, pady=0, sticky="ew")

    def load_config(self):
        if os.path.exists(self.config_path):
            with open(self.config_path, "r") as f:
                self.saved_config = json.load(f)
        else:
            self.saved_config = {}

    def save_config(self):
        config = {
            "folder": self.entry_folder.get(),
            "delay": int(self.entry_delay.get()),
            "coords": self.coords
        }
        with open(self.config_path, "w") as f:
            json.dump(config, f)

    def browse_folder(self):
        path = filedialog.askdirectory()
        if path:
            self.entry_folder.delete(0, tk.END)
            self.entry_folder.insert(0, path)
            self.save_config()

    def log(self, message):
        self.textbox_log.insert(tk.END, f"[{time.strftime('%H:%M:%S')}] {message}\n")
        self.textbox_log.see(tk.END)

    def start_coord_picker(self):
        self.attributes("-alpha", 0.3)
        self.log("5 saniye içinde farenizi 'Change' butonuna götürün...")
        self.update()
        
        def pick():
            time.sleep(5)
            x, y = pyautogui.position()
            self.coords = (x, y)
            self.label_coords_val.configure(text=f"Koordinat: {self.coords}")
            self.log(f"Koordinat seçildi: {x, y}")
            self.attributes("-alpha", 1.0)
            self.save_config()

        threading.Thread(target=pick).start()

    def start_automation(self):
        folder = self.entry_folder.get()
        if not folder or not os.path.exists(folder):
            self.show_modern_alert("Hata", "Lütfen geçerli bir klasör seçin.")
            return
        
        if not self.coords:
            self.show_modern_alert("Hata", "Lütfen önce tıklama koordinatını belirleyin.")
            return

        try:
            delay = int(self.entry_delay.get())
        except:
            self.show_modern_alert("Hata", "Lütfen geçerli bir bekleme süresi girin.")
            return

        self.btn_start.configure(state="disabled")
        self.btn_stop.configure(state="normal")
        self.save_config()

        self.automator = TelegramAutomator(folder, delay, self.coords)
        
        def run():
            self.automator.run_macro(self.log)
            self.btn_start.configure(state="normal")
            self.btn_stop.configure(state="disabled")

        threading.Thread(target=run, daemon=True).start()

    def stop_automation(self):
        if self.automator:
            self.automator.stop()
            self.log("Durduruluyor...")

    def show_modern_alert(self, title, message):
        # Basit bir CTk Toplevel penceresi ile modern alert
        alert = ctk.CTkToplevel(self)
        alert.title(title)
        alert.geometry("300x150")
        alert.attributes("-topmost", True)
        
        label = ctk.CTkLabel(alert, text=message, wraplength=250)
        label.pack(pady=20)
        
        btn = ctk.CTkButton(alert, text="Tamam", command=alert.destroy)
        btn.pack(pady=10)

if __name__ == "__main__":
    app = App()
    app.mainloop()
