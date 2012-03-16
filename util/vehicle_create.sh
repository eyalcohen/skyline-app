#!/bin/bash

D=`dirname $0`

host=${1:-localhost:8080}

read -p 'New Vehicle Title, e.g., "2011 Chevy Volt"? ' -e title
read -p 'New Vehicle Description, e.g., "My city commuter"? ' -e description
read -p 'New Vehicle Nickname, e.g., "myvolt"? ' -e nickname

enc() { $D/url_encode.js "$@" ; }

curl --data-urlencode '' "http://$host/create/vehicle/"`enc "$title"`/`enc "$description"`/`enc "$nickname"` ; echo
