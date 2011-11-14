#!/bin/sh

# Stop all skyline services

if [ `id -u` -ne 0 ]; then echo This script must be run as root\!; exit 1; fi

initctl list | grep '^skyline-.*running' | while read SERVICE MAYBEPORT REST; do
  PORT=`expr "$MAYBEPORT" : '^(\([0-9][0-9]*\))$'`
  stop $SERVICE PORT=$PORT
done
