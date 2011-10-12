#!/bin/bash

db=${1:-localhost/service-samples}

read -p 'Email? ' -e email

mongo "$db" --eval "db.users.remove({ email: '$email' })"
