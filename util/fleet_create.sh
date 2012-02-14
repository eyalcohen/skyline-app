#!/bin/bash

D=`dirname $0`

host=${1:-localhost:8080}

read -p 'New Fleet Title, e.g., "R&D Nissan Leafs"? ' -e title
read -p 'New Fleet Description, e.g., "Our fleet of Leafs used for benchmarking our systems."? ' -e description
read -p 'New Fleet Nickname, e.g., "leafs"? ' -e nickname
read -p 'New Fleet Vehicles, i.e., a list of comma seperated vehicleIds? ' -e vehicleIds

if [ "$vehicleIds" == "" ]; then
  vehicleIds="null"
fi

enc() { $D/url_encode.js "$@" ; }
curl --data-urlencode "password=$password" "http://$host/create/fleet/"`enc "$title"`/`enc "$description"`/`enc "$nickname"`/`enc "$vehicleIds"` ; echo
