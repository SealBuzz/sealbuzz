const { SQSClient, CreateQueueCommand } = require("@aws-sdk/client-sqs");
const logger = require("../../utils/logger")("dev");

const createSQS = async (sqs, sqsName, dlqARN) => {
  const params = {
    QueueName: sqsName,
    Attributes: {
      VisibilityTimeout: 30,
      ReceiveMessageWaitTimeSeconds: 0,
      MessageRetentionPeriod: 345600,
      DelaySeconds: 0,
      RedrivePolicy: JSON.stringify({
        deadLetterTargetArn: dlqARN,
        maxReceiveCount: 10,
      }),
    },
  };
  const command = new CreateQueueCommand(params);

  try {
    const { QueueUrl } = await sqs.send(command);
    logger.debugSuccess(`Successfully created SQS: ${QueueUrl}`);
    return QueueUrl;
  } catch (err) {
    logger.debugError("Error", err);
    throw new Error(err);
  }
};

module.exports = async (region, sqsName, dlqARN) => {
  // Create an SQS client service object
  const sqs = new SQSClient({ region });

  // Create SQS
  const sqsUrl = await createSQS(sqs, sqsName, dlqARN);
  return sqsUrl;
};