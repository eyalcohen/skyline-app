#!/bin/bash

D=`dirname $0`

host=${1:-localhost:8080}

read -p 'Email? ' -e email
read -p 'Password? ' -s password ; echo
read -p 'Make? ' -e make
read -p 'Model? ' -e model
read -p 'Year? ' -e year

enc() { $D/url_encode.js "$@" ; }
curl --data-urlencode "password=$password" "http://$host/vehiclecreate/"`enc "$email"`/`enc "$make"`/`enc "$model"`/`enc "$year"` ; echo
