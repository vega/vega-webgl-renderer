if [ -e .selenium.pid ]; then
  echo "Selenium server seems to already be running (PID $(cat .selenium.pid))" >&2
  exit 1
fi
selenium-standalone start &
echo $! > .selenium.pid
