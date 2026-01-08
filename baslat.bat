@echo off
setlocal
echo ==========================================
echo    TELEGRAM TR CHANGE - BASLATICI
echo ==========================================
echo.

:: Yerel bin klasörünü PATH'e ekle (npm'in modülleri bulması için)
set PATH=%PATH%;%~dp0node_modules\.bin

echo [1/2] Bağımlılıklar kontrol ediliyor ve yükleniyor...
echo Bu işlem ilk seferde birkaç dakika sürebilir, lütfen bekleyin...
call npm install

echo.
echo [2/2] Uygulama çalıştırılıyor...
call npm run dev

if %errorlevel% neq 0 (
    echo.
    echo [HATA] Bir sorun oluştu! 
    echo Uygulama başlatılamadı. Lütfen yukarıdaki hata mesajlarını inceleyin.
    echo.
    pause
)
pause
