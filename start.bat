@echo off
title Repute · Trust Layer Demo
color 0A

echo.
echo  ===================================================
echo   Repute v0.4.1 · Arc Testnet · Circle + x402
echo   NaiveAgent vs ReputeAgent · Live Benchmark
echo  ===================================================
echo.

:: Check .env exists
if not exist .env (
  echo  [ERROR] .env not found.
  echo  Copy .env.example to .env and fill in your keys.
  echo  Then re-run this script.
  echo.
  pause
  exit /b 1
)

:: Check pnpm
where pnpm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo  [ERROR] pnpm not found.
  echo  Install it with: npm i -g pnpm
  echo.
  pause
  exit /b 1
)

echo  Starting services in order...
echo.

:: 1. Merchants must be first — buyers need them running
echo  [1/6] Merchant agents        ports 4001-4006
start "Repute · Merchants" cmd /k "title Repute Merchants && cd /d %~dp0 && pnpm merchants"
timeout /t 3 /nobreak >nul

:: 2. API before indexer so ingest endpoint is ready
echo  [2/6] API server             port 3001
start "Repute · API" cmd /k "title Repute API :3001 && cd /d %~dp0 && pnpm api"
timeout /t 2 /nobreak >nul

:: 3. Indexer (reads from DB, also forwards to scoring)
echo  [3/6] Indexer
start "Repute · Indexer" cmd /k "title Repute Indexer && cd /d %~dp0 && pnpm indexer"
timeout /t 1 /nobreak >nul

:: 4. Scoring engine
echo  [4/6] Scoring engine
start "Repute · Scoring" cmd /k "title Repute Scoring && cd /d %~dp0 && pnpm scoring"
timeout /t 1 /nobreak >nul

:: 5. Web dashboard
echo  [5/6] Web dashboard          port 3000
start "Repute · Web" cmd /k "title Repute Web :3000 && cd /d %~dp0 && pnpm web"
timeout /t 2 /nobreak >nul

:: 6. Buyers last — needs merchants + API both running
echo  [6/6] Buyer agents           NaiveAgent + ReputeAgent
start "Repute · Buyers" cmd /k "title Repute Buyers && cd /d %~dp0 && pnpm buyers"

echo.
echo  ===================================================
echo   All 6 services started.
echo.
echo   Landing page  :  http://localhost:3000
echo   Dashboard     :  http://localhost:3000/app
echo   Live Benchmark:  http://localhost:3000/app  (sidebar)
echo   API           :  http://localhost:3001
echo  ===================================================
echo.
echo  Press any key to open the dashboard in your browser.
pause >nul
start "" "http://localhost:3000"
