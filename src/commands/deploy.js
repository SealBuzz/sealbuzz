const path = require("path");
const logger = require('../utils/logger')('deploy');
const { readFile, fileExists, delay } = require("../utils/utilities");
const ora = require("ora");

const createRole = require("../aws/deploy/createRole");
const deployS3 = require('../aws/deploy/deployS3');
const deployDlq = require('../aws/deploy/deployDlq');
const deploySqs = require("../aws/deploy/deploySqs");
const deployDynamo = require("../aws/deploy/deployDynamo");
const deployApiGateway = require("../aws/deploy/deployApiGateway");
const deployPostLambda = require("../aws/deploy/deployPostLambda");
const deployPreLambda = require('../aws/deploy/deployPreLambda');
const deployCloudwatchEvent = require('../aws/deploy/deployCloudwatchEvent');
const deployPollingRoute = require("../aws/deploy/deployPollingRoute");
const deployPollingS3Object = require("../aws/deploy/deployPollingS3Object");
const addPostLambdaEventPermission = require("../aws/deploy/addPostLambdaEventPermission");

const ANSWERS_FILE_PATH = path.join(__dirname, "..", "config", "user-answers.json");
const S3_ASSET_PATH = path.join(__dirname, "..", "..", "assets", "s3");
const POST_LAMBDA_ASSET = path.join(__dirname, "..", "..", "assets", "postlambda", 'index.js.zip');
const PRE_LAMBDA_ASSET = path.join(__dirname, "..", "..", "assets", "prelambda", 'index.js.zip');
const POLL_FILE_PATH = path.join(__dirname, "..", "..", "assets", "s3", 'polling.js');

module.exports = async () => {
  let fileFound = await fileExists(ANSWERS_FILE_PATH);

  if (!fileFound) {
    console.log("");
    logger.warning("Error: Run 'sealbuzz start' first.");
    return;
  }

  const { WAITING_ROOM_NAME, REGION, PROTECT_URL } = JSON.parse(await readFile(ANSWERS_FILE_PATH));
  const S3_NAME = `wr-${WAITING_ROOM_NAME}-s3`
  const DLQ_NAME = `wr-${WAITING_ROOM_NAME}-dlq`
  const SQS_NAME = `wr-${WAITING_ROOM_NAME}-sqs`
  const DYNAMO_NAME = `wr-${WAITING_ROOM_NAME}-ddb`
  const API_GATEWAY_NAME = `wr-${WAITING_ROOM_NAME}-apigateway`
  const POST_LAMBDA_NAME = `wr-${WAITING_ROOM_NAME}-postlambda`
  const PRE_LAMBDA_NAME = `wr-${WAITING_ROOM_NAME}-prelambda`
  const ROLE_NAME = `wr-${WAITING_ROOM_NAME}-master-role`
  const CRON_JOB_NAME = `wr-${WAITING_ROOM_NAME}-cloudwatcheventcron`
  const STAGE_NAME = 'sealbuzz-production';
  const RATE = 100

  const spinner = ora();

  logger.highlight('🐝  Deploying waiting room infrastructure');
  // Create Role
  const roleArn = await createRole(REGION, ROLE_NAME);
  // await logger.process(10000, '%s sealing buzz...');
  // console.log('\n');

  spinner.start('Creating role');
  await delay(5000);
  spinner.succeed('Successfully created role.');

  // Deploy S3 Bucket + S3 Objects
  const s3ObjectRootDomain = await deployS3(REGION, S3_NAME, S3_ASSET_PATH);

  spinner.start('Deploying S3 bucket');
  await delay(2000);
  spinner.succeed('Successfully deployed S3 bucket');

  // Deploy DLQ
  const dlqArn = await deployDlq(REGION, DLQ_NAME);

  spinner.start('Deploying DLQ');
  await delay(2000);
  spinner.succeed('Successfully deployed DLQ');

  // Deploy SQS
  const sqsUrl = await deploySqs(REGION, SQS_NAME, dlqArn);

  spinner.start('Deploying SQS');
  await delay(2000);
  spinner.succeed('Successfully deployed SQS');

  // Deploy DynamoDB
  const dbArn = await deployDynamo(REGION, DYNAMO_NAME);

  spinner.start('Deploying DynamoDB');
  await delay(2000);
  spinner.succeed('Successfully deployed DynamoDB');

  // Deploy Post Lambda
  const postLambdaArn = await deployPostLambda(REGION, POST_LAMBDA_NAME, sqsUrl, POST_LAMBDA_ASSET, roleArn, DYNAMO_NAME, RATE);

  // Deploy Cloudwatch Event Rules for Post Lambda (CRON)
  const eventArn = await deployCloudwatchEvent(REGION, postLambdaArn, CRON_JOB_NAME);

  // Add event permission
  await addPostLambdaEventPermission(REGION, POST_LAMBDA_NAME, eventArn);

  spinner.start('Deploying Post Lambda');
  await delay(2000);
  spinner.succeed('Successfully deployed Post Lambda');

  // Deploy Pre Lambda
  const preLambdaArn = await deployPreLambda(REGION, PRE_LAMBDA_NAME, sqsUrl, PRE_LAMBDA_ASSET, roleArn, s3ObjectRootDomain);

  spinner.start('Deploying Pre Lambda');
  await delay(2000);
  spinner.succeed('Successfully deployed Pre Lambda');

  // Deploy API Gateway + Waiting Room Route
  const { restApiId, stageSealBuzzUrl } = await deployApiGateway(REGION, API_GATEWAY_NAME, preLambdaArn, STAGE_NAME);

  // Deploy Waiting Room Polling Route on API Gateway
  const stagePollingUrl = await deployPollingRoute(restApiId, REGION, API_GATEWAY_NAME, dbArn, roleArn, s3ObjectRootDomain, STAGE_NAME, PROTECT_URL);

  // Create and upload poll.js to S3 bucket
  await deployPollingS3Object(REGION, S3_NAME, stagePollingUrl, POLL_FILE_PATH);

  spinner.start('Deploying API Gateway');
  await delay(2000);
  spinner.succeed('Successfully deployed API Gateway');

  
  logger.log(stageSealBuzzUrl);
}