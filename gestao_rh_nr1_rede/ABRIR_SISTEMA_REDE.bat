@echo off
chcp 65001 >nul
cls
echo ==============================================
echo  GESTAO RH NR-1 - SERVIDOR EM REDE
echo ==============================================
echo.
echo Este arquivo vai abrir o sistema na rede local.
echo Deixe esta janela aberta enquanto os funcionarios respondem.
echo.
node -v >nul 2>&1
if errorlevel 1 (
  echo ATENCAO: Node.js nao foi encontrado.
  echo Instale o Node.js em https://nodejs.org/ e execute novamente.
  echo.
  pause
  exit /b
)
node server.js
pause
