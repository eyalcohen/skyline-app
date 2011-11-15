#!/bin/sh

# Restart all skyline frontends one at a time

if [ `id -u` -ne 0 ]; then echo This script must be run as root\!; exit 1; fi

initctl list | grep '^skyline-frontend.*running' | while read SERVICE MAYBEPORT REST; do
  PORT=`expr "$MAYBEPORT" : '^(\([0-9][0-9]*\))$'`
  restart $SERVICE PORT=$PORT
  sleep 10
done
