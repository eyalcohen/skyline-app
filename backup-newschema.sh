#!/bin/sh

# check backup directory
if [ $# -eq 0 ]
then
  DIR=./backups
else
  DIR=$1
fi
mkdir -p $DIR
cd $DIR
touch backups.log

# save time
now=`date +%Y.%m.%d.%H.%M.%S`

# perform the backup on the remote database server
echo "backing up remote database..."
ssh -i ~/.ec2/ridemissionkey.pem ec2-user@50.19.106.243 ./backup-remote-newschema.sh

# fetch and stash the backup
echo "fetching backup from remote..."
scp -i ~/.ec2/ridemissionkey.pem ec2-user@50.19.106.243:backups/service-db.tar.bz2 service-db.$now.tar.bz2

# unpacking backup 
echo "unpacking remote backup..."
tar xjf service-db.$now.tar.bz2

# clear the local database
echo "dropping local database..."
mongo localhost:27017/service-samples --quiet --eval "var dropped = db.dropDatabase()" >> backups.log 2>&1

# restore the local database
echo "restoring local database from remote backup..."
mongorestore -d service-samples -h localhost:27017 service-db >> backups.log 2>&1

# delete the uncompressed directory
echo "cleaning up..."
rm -rf service-db

# done
echo "done."
exit 0

