#!/bin/sh

if [ ! -d /etc/init ]; then echo System not using upstart\!; exit 1; fi
if [ `id -u` -ne 0 ]; then echo This script must be run as root\!; exit 1; fi

D="`dirname "$0"`"

rm -f /etc/init/skyline*
cp -v "$D"/init/skyline* /etc/init/
