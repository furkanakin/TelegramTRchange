@echo off
echo Uygulama baslatiliyor...
echo Moduller kontrol ediliyor...
npm run dev
if %errorlevel% neq 0 (
    echo.
    echo Bir hata olustu! Lutfen yukaridaki hatayi kontrol edin.
    pause
)
pause
