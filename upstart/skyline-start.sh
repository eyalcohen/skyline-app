#!/bin/sh

# Start all skyline services

if [ `id -u` -ne 0 ]; then echo This script must be run as root\!; exit 1; fi

start skyline
initctl list | grep '^skyline-'
