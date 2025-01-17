/**
 * Destroys a waiting room infrastructure.
 * @module destroy
 */

const path = require("path");
const logger = require("../utils/logger")("dev");
const { readFile, validateInitRan, validateProfileName } = require("../utils/utilities");
const chalk = require("chalk");
const ora = require("ora");

const destroyRole = require("../aws/destroy/destroyRole");
const destroyLambda = require("../aws/destroy/destroyLambda");
const destroySQS = require("../aws/destroy/destroySQS");
const destroyDynamo = require("../aws/destroy/destroyDynamo");
const destroyAutoScaling = require("../aws/destroy/destroyAutoScaling");
const destroyCloudwatchEvent = require("../aws/destroy/destroyCloudwatchEvent");
const destroyS3 = require("../aws/destroy/destroyS3");
const destroyApiGateway = require("../aws/destroy/destroyApiGateway");

const ANSWERS_FILE_PATH = path.join(
  __dirname,
  "..",
  "config",
  "user-answers.json"
);

/**
 * The destroy command combines all of the destroy modules and invokes them with the required parameters.
 * @param {string} profileName The profile to destroy
 * @returns {undefined}
 */

module.exports = async (profileName) => {
  const initRan = await validateInitRan(ANSWERS_FILE_PATH);
  if (!initRan) return;
  
  const profiles = JSON.parse(await readFile(ANSWERS_FILE_PATH));
  const validProfileName = validateProfileName(profileName, profiles, "destroy");
  if (!validProfileName) return;

  const {[profileName] : { PROFILE_NAME, REGION, DRT }} = profiles;
  const S3_NAME = `beekeeper-${PROFILE_NAME}-s3`
  const DLQ_NAME = `beekeeper-${PROFILE_NAME}-dlq`
  const SQS_NAME = `beekeeper-${PROFILE_NAME}-sqs`
  const DYNAMO_NAME = `beekeeper-${PROFILE_NAME}-ddb`
  const API_GATEWAY_NAME = `beekeeper-${PROFILE_NAME}-apigateway`
  const POST_LAMBDA_NAME = `beekeeper-${PROFILE_NAME}-postlambda`
  const PRE_LAMBDA_NAME = `beekeeper-${PROFILE_NAME}-prelambda`
  const TRIGGER_LAMBDA_NAME = `beekeeper-${PROFILE_NAME}-triggerlambda`
  const DRT_LAMBDA_NAME = `beekeeper-${PROFILE_NAME}-drtlambda`
  const DRT_DYNAMO_NAME = `beekeeper-${PROFILE_NAME}-drtdb`
  const ROLE_NAME = `beekeeper-${PROFILE_NAME}-master-role`
  const CRON_JOB_NAME = `beekeeper-${PROFILE_NAME}-cloudwatcheventcron`
  const spinner = ora();
  let warn = false;

  logger.highlight('🐝  Destroying waiting room infrastructure');
  console.log("")
  
  try {
    spinner.start("Destroying IAM role")
    await destroyRole(REGION, ROLE_NAME);
    spinner.succeed("Successfully destroyed IAM role")
  } catch (err) {
    warn = true;
    spinner.warn("Warning: (IAM role) " + err.message.split(":")[0])
  }

  try {
    spinner.start("Destroying post-lambda")
    await destroyLambda(REGION, POST_LAMBDA_NAME);
    await destroyLambda(REGION, TRIGGER_LAMBDA_NAME);
    spinner.succeed("Successfully destroyed post-lambda")
  } catch (err) {
    warn = true;
    spinner.warn("Warning: (post-lambda) " + err.message.split(":")[0])
  }

  try {
    spinner.start("Destroying pre-lambda")
    await destroyLambda(REGION, PRE_LAMBDA_NAME);
    spinner.succeed("Successfully destroyed pre-lambda")
  } catch (err) {
    warn = true;
    spinner.warn("Warning: (pre-lambda) " + err.message.split(":")[0])
  }

  try {
    spinner.start("Destroying DLQ")
    await destroySQS(REGION, DLQ_NAME);
    spinner.succeed("Successfully destroyed DLQ")
  } catch (err) {
    warn = true;
    spinner.warn("Warning: (DLQ) " + err.message.split(":")[0])
  }

  try {
    spinner.start("Destroying SQS")
    await destroySQS(REGION, SQS_NAME);
    spinner.succeed("Successfully destroyed SQS")
  } catch (err) {
    warn = true;
    spinner.warn("Warning: (SQS) " + err.message.split(":")[0])
  }

  try {
    spinner.start("Destroying DynamoDB")
    await destroyDynamo(REGION, DYNAMO_NAME);
    spinner.succeed("Successfully destroyed DynamoDB")
  } catch (err) {
    warn = true;
    spinner.warn("Warning: (DynamoDB) " + err.message.split(":")[0])
  }

  try {
    spinner.start("Destroying Cloudwatch Event")
    await destroyCloudwatchEvent(REGION, CRON_JOB_NAME);
    spinner.succeed("Successfully destroyed Cloudwatch Event")
  } catch (err) {
    warn = true;
    spinner.warn("Warning: (Cloudwatch Event) " + err.message.split(":")[0])
  }

  try {
    spinner.start("Destroying S3 bucket")
    await destroyS3(REGION, S3_NAME);
    spinner.succeed("Successfully destroyed S3 bucket")
  } catch (err) {
    warn = true;
    spinner.warn("Warning: (S3 bucket) " + err.message.split(":")[0])
  }

  try {
    spinner.start("Destroying API Gateway")
    await destroyApiGateway(REGION, API_GATEWAY_NAME);
    spinner.succeed("Successfully destroyed API Gateway")
  } catch (err) {
    warn = true;
    spinner.warn("Warning: (API Gateway) " + err.message.split(":")[0])
  }

  if (DRT) {
    try {
      spinner.start("Destroying drt-lambda")
      await destroyDynamo(REGION, DRT_DYNAMO_NAME)
      await destroyLambda(REGION, DRT_LAMBDA_NAME)
      spinner.succeed("Successfully destroyed drt-lambda")
    } catch (err) {
      warn = true;
      spinner.warn("Warning: (drt-lambda) " + err.message.split(":")[0])
    }
  }

  console.log("")
  
  if (warn) {
    console.log(`Note: It's normal to see "${chalk.yellow.bold("⚠")} Warning" if that piece of the infrastructure has not been deployed yet.`)
    console.log("")
  }
  logger.highlight(`${chalk.green.bold("✔")} Successfully destroyed waiting room infrastructure`);
};
