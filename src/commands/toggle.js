const {
  LambdaClient,
  UpdateFunctionConfigurationCommand,
  GetFunctionConfigurationCommand
} = require("@aws-sdk/client-lambda");
const chalk = require("chalk");
const path = require("path");
const logger = require("../utils/logger")("dev");
const { readFile, validateInitRan, validateProfileName } = require("../utils/utilities");


const ANSWERS_FILE_PATH = path.join(
  __dirname,
  "..",
  "config",
  "user-answers.json"
);

const updateLambdaConfig = async (lambda, lambdaName, environment, waitroomOnOff) => {
  environment.Variables.WAITROOM_ON = waitroomOnOff;
  
  const params = {
    FunctionName: lambdaName,
    Environment: environment
  };

  const command = new UpdateFunctionConfigurationCommand(params);

  try {
    await lambda.send(command);
    logger.debugSuccess(`Successfully updated PreLambda environment variable`);
  } catch (err) {
    logger.debugError("Error", err);
  }
}

const getLambdaConfig = async (lambda, lambdaName) => {
  const params = {
    FunctionName: lambdaName
  };

  const command = new GetFunctionConfigurationCommand(params);

  try {
    const lambdaConfig = await lambda.send(command);
    logger.debugSuccess(`Successfully retrieved PreLambda configuration`);
    return lambdaConfig;
  } catch (err) {
    logger.debugError("Error", err);
  }
}

module.exports = async (onOff) => {
  
  const WAITROOM_ON = onOff === "on" ? "true" : "false";

  return (profileName) => {

    const initRan = await validateInitRan(ANSWERS_FILE_PATH);
    if (!initRan) return;
  
    const profiles = JSON.parse(await readFile(ANSWERS_FILE_PATH));
    const validProfileName = validateProfileName(profileName, profiles, onOff);
    if (!validProfileName) return;
  
    const PRE_LAMBDA_NAME = `beekeeper-${profileName}-prelambda`;
    const { REGION } = profiles[profileName];
  
    // Create a Lambda client service object
    const lambda = new LambdaClient({ REGION });
  
    try {
      const { Environment:environment } = await getLambdaConfig(lambda, PRE_LAMBDA_NAME);
      await updateLambdaConfig(lambda, PRE_LAMBDA_NAME, environment, WAITROOM_ON);
      logger.highlight(`${chalk.green.bold("✔")} Successfully turned ${onOff} waiting room`);
    } catch (err) {
      logger.error(`Failed to turn ${onOff} waiting room.`);
      console.log("");
      console.log(`Note: If you haven't deployed a waiting room yet, please enter ${chalk.yellow.bold('beekeeper deploy [PROFILE_NAME]')} first.`);
    }
  }
};