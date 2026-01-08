@echo off
setlocal
chcp 65001 > nul
echo ==========================================
echo    TELEGRAM TR CHANGE - BASLATICI
echo ==========================================
echo.

:: Klasörün içine gir (VDS'de bazen root dizinde kalabiliyor)
cd /d "%~dp0"

:: Yerel bin klasörünü PATH'e ekle
set PATH=%PATH%;%~dp0node_modules\.bin

echo [1/2] Bağımlılıklar yükleniyor...
echo Bu işlem internet hızınıza bağlı olarak zaman alabilir.
echo Lütfen ekranın ilerlemesini bekleyin...
echo.

:: Hareketsiz kalmaması için verbose modda çalıştırıyoruz
call npm install --loglevel info

if %errorlevel% neq 0 (
    echo.
    echo [HATA] Kütüphaneler yüklenirken bir sorun oluştu!
    echo İnternet bağlantınızı veya Node.js kurulumunuzu kontrol edin.
    pause
    exit /b %errorlevel%
)

echo.
echo [2/2] Uygulama çalıştırılıyor...
call npm run dev

if %errorlevel% neq 0 (
    echo.
    echo [HATA] Uygulama başlatılamadı.
    pause
)
pause
