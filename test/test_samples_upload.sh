#!/bin/sh -v -e

# unzip samples-db.zip -d /tmp
# mongod --dbpath /tmp/r0
# app.js
# ../util/delete_vehicle_data.js --vehicleId=1233922067

../util/samples_encode.js < samples.json > /tmp/samples.pbraw
curl -T /tmp/samples.pbraw -H 'Content-type: application/octet-stream' http://localhost:8080/samples
../util/query.js --vehicleId=1233922067 --json
