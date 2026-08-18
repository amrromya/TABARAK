@echo off
chcp 65001 >nul
title 🔐 أداة توليد أكواد التفعيل - برنامج تبارك

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║        🔐 أداة توليد أكواد التفعيل - برنامج تبارك           ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

REM التحقق من تثبيت Python
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python غير مثبت! يرجى تثبيت Python من:
    echo    https://www.python.org/downloads/
    pause
    exit /b 1
)

REM تثبيت المكتبات المطلوبة
echo 📦 تثبيت المكتبات المطلوبة...
pip install -r requirements.txt -q

echo.
echo 🚀 تشغيل أداة التفعيل...
echo.
python keygen.py

pause
