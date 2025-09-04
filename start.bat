@echo off
echo ========================================
echo   Isometric Tile Editor - Quick Start
echo   TypeScript + Vite + Electron
echo ========================================
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    npm install
    echo.
)

REM Run the development environment
echo 🚀 Starting development environment...
echo   - Vite dev server will start on http://localhost:5173
echo   - Electron app will launch automatically
echo   - Both will reload automatically on changes
echo.
echo Press Ctrl+C to stop both servers
echo.

npm run go
