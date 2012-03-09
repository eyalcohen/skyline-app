#!/bin/bash

host=${1:-localhost:8080}

read -p 'Full Name? ' -e fullName
read -p 'Email? ' -e email
read -p 'Password? ' -s password ; echo
read -p 'Password again? ' -s password2 ; echo

if [ "$password" != "$password2" ]; then
  echo "Passwords don't match\!"
  exit 1
fi

curl --data-urlencode "fullName=$fullName" --data-urlencode "password=$password" "http://$host/create/user/$email" ; echo

