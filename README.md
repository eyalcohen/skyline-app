# Skyline

### Development

1. Download and install [Node.JS](http://nodejs.org/download/) from the latest stable source or package installer (recommended).
2. Download and install [MongoDB](http://www.mongodb.org/downloads) from the latest stable source. Use ```$ bin/mongod``` to start a local DB server in the background.
3. Download and install [Redis](http://redis.io/download). Do something like [this](http://reistiago.wordpress.com/2011/07/23/installing-on-redis-mac-os-x/) to start the Redis server via a launch daemon, or just do ```$ redis-server``` whenever developing.
4. Install application dependencies with ```$ npm install```. This will install everything specified in ```package.json```.
5. Install ```nodemon``` globally with ```$ npm install nodemon -g```. Use ```nodemon``` in place of ```node``` to restart your local web server whenever changes are made... very handy.
5. Now you can start your local web server.

```
$ nodemon main.js
```

Skyline is now running at [```http://localhost:8080/```](http://localhost:8080/).


### Deployment

##### Setup

Skyline runs in production on [AWS Elastic Beanstalk](http://aws.amazon.com/elasticbeanstalk/).

1. Install the [command line interface](http://aws.amazon.com/code/6752709412171743) for EBS.  You may also need to install python's boto (``` pip install boto```)
2. Install ruby (```apt-get install ruby``` on Linux)
3. Run ```eb init``` to initialize the Amazon file structure and supply the correct Git commands
4. Modify the file structure at the top-level of your local repo.

```
.aws
	aws_credential_file
	skyline.pem
.elasticbeanstalk
	config
	optionsettings.app
```

```.aws/aws_credential_file``` : (_Get these values from Sander or Eyal_)

```
AWSAccessKeyId=<YOUR_IAM_ACCESS_KEY_ID>
AWSSecretKey=<YOUR_IAM_SECRET_KEY>
AWSRegion=us-east-1
```

```.aws/skyline.pem``` : (_Used to ```tail``` logs... get this from Sander or Eyal_)

```.elasticbeanstalk/config``` : (_\<PATH\_TO\_SKYLINE\> must be absolute_)

```
[global]
ApplicationName=skyline-app
AwsCredentialFile=<PATH_TO_SKYLINE>/.aws/aws_credential_file
DevToolsEndpoint=git.elasticbeanstalk.us-east-1.amazonaws.com
EnvironmentName=skyline-app-env
InstanceProfileName=aws-elasticbeanstalk-ec2-role
OptionSettingFile=<PATH_TO_SKYLINE>/.elasticbeanstalk/optionsettings.app
RdsEnabled=No
Region=us-east-1
ServiceEndpoint=https://elasticbeanstalk.us-east-1.amazonaws.com
SolutionStack=64bit Amazon Linux 2014.03 v1.0.4 running Node.js
```

```.elasticbeanstalk/optionsettings.app``` :

```
[aws:autoscaling:asg]
MaxSize=3
MinSize=3

[aws:autoscaling:launchconfiguration]
InstanceType=t2.medium
EC2KeyName=skyline
IamInstanceProfile=aws-elasticbeanstalk-ec2-role

[aws:elasticbeanstalk:application:environment]
AWS_ACCESS_KEY_ID=<YOUR_IAM_ACCESS_KEY_ID>
AWS_SECRET_KEY=<YOUR_IAM_SECRET_KEY>
AWS_REGION=us-east-1
NODE_ENV=production
MONGO_URI=<MONGO_URI>
REDIS_HOST_CACHE=<REDIS_HOST_CACHE>
REDIS_HOST_SESSION=<REDIS_HOST_SESSION>
REDIS_PORT=6379
GMAIL_USER=<GMAIL_USER>
GMAIL_PASSWORD=<GMAIL_PASSWORD>
GMAIL_FROM=<GMAIL_FROM>
GMAIL_HOST=smtp.gmail.com
GMAIL_SSL=true
GOOGLE_CLIENT_ID=<GOOGLE_CLIENT_ID>
GOOGLE_CLIENT_SECRET=<GOOGLE_CLIENT_SECRET>
FACEBOOK_NAME=Skyline
FACEBOOK_CLIENT_ID=<FACEBOOK_CLIENT_ID>
FACEBOOK_CLIENT_SECRET=<FACEBOOK_CLIENT_SECRET>
TWITTER_CONSUMER_KEY=<TWITTER_CONSUMER_KEY>
TWITTER_CONSUMER_SECRET=<TWITTER_CONSUMER_SECRET>
CARTODB_USER=skyline
CARTODB_TABLE=samples
CARTODB_KEY=<CARTODB_KEY>
PUB_SOCKET_PORT=<PUB_SOCKET_PORT>
SUB_SOCKET_PORT=<SUB_SOCKET_PORT>

[aws:elasticbeanstalk:container:nodejs]
GzipCompression=false
NodeCommand=node start.js
NodeVersion=0.10.26
ProxyServer=none

[aws:elasticbeanstalk:hostmanager]
LogPublicationControl=true

[aws:elasticbeanstalk:monitoring]
Automatically Terminate Unhealthy Instances=true

[aws:elb:loadbalancer]
LoadBalancerHTTPPort=80
LoadBalancerPortProtocol=TCP
LoadBalancerHTTPSPort=443
LoadBalancerSSLPortProtocol=SSL
SSLCertificateId=www_skyline-data_com
```

Lastly, install the frontend builder globally.

```
$ npm install grunt-cli -g
```

##### Shipping

Now that everyting is setup, you can concat and minify JS files and send the frontend to Amazon S3.

```
$ ./ship.js .
```

Then deploy to EBS with ```eb push``` or just do it via ```ship.js```.

```
$ ./ship.js --push .
```

Check that your new version of Skyline is running at [```https://www.skyline-data.com```](https://www.skyline-data.com).

Lastly, ```git push``` the version bump auto-commit to avoid conflicts in ```package.json``` and/or overwriting old frontend directory on Amazon S3.

That's it!

### Archicture Notes

##### Search

Search is done on a redis instance.  Any search string is inserted into a Redis sorted set with the format ```string::id```.  Search is then accomplished by doing a lexicographical comparison on the query.  For example, searching for ```sp``` will return any search entry that begins with ```sp``` such as ```speed``` and ```spit```.  

We index of datasets, channels, users and views across their names, tags and source information.  Entries into the redis cluster are automatically stemmed.

The architecture for search doesn't allow for removal of entries very easily (would need to search the sorted set for an entry which is difficult to do in Redis).  Because removal is rare, a good solution is to just re-index nightly.  This can be accomplished by installing Node where the Redis instance is located and running a cron job like below.

```0 3 * * * NODE_ENV=production bash -c 'time /home/ec2-user/skyline-app/util/index.js' >> /var/log/index.js 2>&1```
