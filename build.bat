@echo off
echo Building TypeScript project...
echo.

REM Install TypeScript if not already installed
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
    echo.
)

REM Clean previous build
if exist "dist" rmdir /s /q dist

REM Compile TypeScript
echo Compiling TypeScript...
npx tsc

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ Build completed successfully!
    echo ✅ Compiled files are in the 'dist' folder
    echo.
    echo To run the project:
    echo 1. Open index.html in your browser, or
    echo 2. Run 'npm run dev' for development server
) else (
    echo.
    echo ❌ Build failed. Please check the TypeScript errors above.
)

pause
