# Skyline

### Development

1. Download and install [Node.JS](http://nodejs.org/download/) from the latest stable source or package installer (recommended).
2. Download and install [MongoDB](http://www.mongodb.org/downloads) from the latest stable source. Use ```$ bin/mongod``` to start a local DB server in the background.
3. Download and install [Redis](http://redis.io/download). Do something like [this](http://reistiago.wordpress.com/2011/07/23/installing-on-redis-mac-os-x/) to start the Redis server via a launch daemon, or just do ```$ redis-server``` whenever developing.
4. Install application dependencies with ```$ npm install```. This will install everything specified in ```package.json```.
5. Install ```nodemon``` globally with ```$ npm install nodemon -g```. Use ```nodemon``` in place of ```node``` to restart your local web server whenever changes are made... very handy.
5. Now you can start your local web server:

```
$ nodemon main.js
```

Skyline is now running at [```http://localhost:8080/```](http://localhost:8080/).


### Deployment

##### Setup

Skyline runs in production on [AWS Elastic Beanstalk](http://aws.amazon.com/elasticbeanstalk/).

1. Install the [command line interface](http://aws.amazon.com/code/6752709412171743) for EBS.
2. Create the following file structure at the top-level of your local repo.

```
.aws
	aws_credential_file
	skyline.pem
.elasticbeanstalk
	config
	optionsettings.skyline
```

```.aws/aws_credential_file```: (_Get these values from Sander or Eyal_)

```
AWSAccessKeyId=<YOUR_IAM_ACCESS_KEY_ID>
AWSSecretKey=<YOUR_IAM_SECRET_KEY>
```

```.aws/skyline.pem```: (_Used to ```tail``` logs... get this from from Sander or Eyal_)

```.elasticbeanstalk/config```: (_\<PATH\_TO\_SKYLINE\> must be absolute_)

```
[global]
ApplicationName=skyline
AwsCredentialFile=<PATH_TO_SKYLINE>/.aws/aws_credential_file
DevToolsEndpoint=git.elasticbeanstalk.us-east-1.amazonaws.com
EnvironmentName=skyline
InstanceProfileName=aws-elasticbeanstalk-ec2-role
OptionSettingFile=<PATH_TO_SKYLINE>/.elasticbeanstalk/optionsettings.skyline
RdsEnabled=No
Region=us-east-1
ServiceEndpoint=https://elasticbeanstalk.us-east-1.amazonaws.com
SolutionStack=64bit Amazon Linux 2014.02 running Node.js

```

```.elasticbeanstalk/optionsettings.skyline```: ()

```
[aws:autoscaling:asg]
Custom Availability Zones=
MaxSize=4
MinSize=1

[aws:autoscaling:launchconfiguration]
EC2KeyName=skyline
InstanceType=m1.small
EC2KeyName=skyline
IamInstanceProfile=aws-elasticbeanstalk-ec2-role
SecurityGroups=awseb-e-mtnpmftmsx-stack-AWSEBSecurityGroup-17RX6M656MZ0W

[aws:ec2:vpc]
ELBScheme=public
ELBSubnets=
Subnets=
VPCId=

[aws:elasticbeanstalk:application]
Application Healthcheck URL=

[aws:elasticbeanstalk:application:environment]
AWS_ACCESS_KEY_ID=AKIAJVM2DIROIDYGRXEA
AWS_SECRET_KEY=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
NODE_ENV=production

[aws:elasticbeanstalk:container:nodejs]
GzipCompression=false
NodeCommand=node main.js
NodeVersion=0.10.26
ProxyServer=none

[aws:elasticbeanstalk:hostmanager]
LogPublicationControl=true

[aws:elasticbeanstalk:monitoring]
Automatically Terminate Unhealthy Instances=true

[aws:elasticbeanstalk:sns:topics]
Notification Endpoint=
Notification Protocol=email

```

Lastly, install the frontend builder globally.

```
$ npm install grunt-cli -g
```

##### Shipping

Now that everyting is setup, you can concat and minify JS files and send the frontend to Amazon S3:

```
$ ./ship .
```

Then deploy to EBS with ```eb push``` or just do it via ```ship``:

```
$ ./ship --push .
```

Check that your new version of Skyline is running at [```http://skyline.elasticbeanstalk.com```](http://skyline.elasticbeanstalk.com).

That's it!
