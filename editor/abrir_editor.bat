@echo off
REM Abre el Editor de Portafolio (doble clic en este archivo)
cd /d "%~dp0"
python -c "import PIL, tkinterdnd2" 2>nul || (
  echo Instalando lo necesario por primera vez...
  python -m pip install -r requirements.txt
)
start "" pythonw editor_portafolio.py
