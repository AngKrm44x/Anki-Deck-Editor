@echo off
rem Build di Windows: installer + portable. Butuh Node.js 18+ (https://nodejs.org)
cd /d "%~dp0"
if not exist node_modules call npm install || goto :err
call node build_app.js || goto :err
call npx electron-builder --win --x64 || goto :err
echo.
echo Selesai. Lihat folder release\
dir release\*.exe
goto :eof
:err
echo Build gagal.
exit /b 1
