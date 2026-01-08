@echo off
TITLE Telegram Dil Degistirici - Kurulum
echo ======================================================
echo Telegram Dil Degistirici Gereksinimleri Kuruluyor...
echo ======================================================

:: Python kontrolü
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [HATA] Python yuklu degil! Lutfen Python yukleyip tekrar deneyin.
    pause
    exit /b
)

echo [1/3] Pip guncelleniyor...
python -m pip install --upgrade pip

echo [2/3] Kutuhaneler kuruluyor (requirements.txt)...
pip install -r requirements.txt

if %errorlevel% equ 0 (
    echo.
    echo ======================================================
    echo [BASARILI] Tum gereksinimler basariyla kuruldu.
    echo Uygulamayi 'python main.py' komutuyla baslatabilirsiniz.
    echo ======================================================
) else (
    echo.
    echo [HATA] Kurulum sirasinda bir sorun olustu.
)

pause
