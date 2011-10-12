#!/bin/bash

db=${1:-localhost/service-samples}

read -p 'VehicleId? ' -e vid

mongo "$db" --eval "db.vehicles.remove({ _id: $vid })"
