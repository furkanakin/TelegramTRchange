@echo off
echo Uygulama baslatiliyor...

if not exist node_modules (
    echo Bağımlılıklar eksik, yükleniyor (npm install)...
    call npm install
)

echo Moduller kontrol ediliyor...
call npm run dev
if %errorlevel% neq 0 (
    echo.
    echo Bir hata olustu! Lutfen yukaridaki hatayi kontrol edin.
    pause
)
pause
