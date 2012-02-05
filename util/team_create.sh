#!/bin/bash

D=`dirname $0`

host=${1:-localhost:8080}

read -p 'New Team Title, e.g., "Mission Motors-Honda EV Engineers"? ' -e title
read -p 'New Team Description, e.g., "Mission Motors and Honda EV research collaboration team"? ' -e description
read -p 'New Team Nickname, e.g., "mission-honda"? ' -e nickname
read -p 'New Team Domains, i.e., a list of comma seperated team domains? ' -e domains
read -p 'New Team Users, i.e., a list of comma seperated userIds? ' -e userIds
read -p 'New Team Admins, i.e., a list of comma seperated userIds that will be admins? ' -e adminIds

if [ "$domains" == "" ]; then
  domains="null"
fi
if [ "$userIds" == "" ]; then
  userIds="null"
fi
if [ "$adminIds" == "" ]; then
  adminIds="null"
fi

enc() { $D/url_encode.js "$@" ; }
curl --data-urlencode "password=$password" "http://$host/create/team/"`enc "$title"`/`enc "$description"`/`enc "$nickname"`/`enc "$domains"`/`enc "$userIds"`/`enc "$adminIds"`; echo
