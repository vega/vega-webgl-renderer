if [ -e .selenium.pid ]; then
  pid=$(cat .selenium.pid)
  kill ${pid}
  rm .selenium.pid
fi
