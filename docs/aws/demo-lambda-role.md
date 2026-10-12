# IAM role for the read-only Lambda demo

Created once with the AWS CLI; `scripts/deploy-demo.sh` then only updates the function. Replace `<region>` and `<account-id>`.

## Trust policy
```json
{
  "Version": "2012-10-17",
  "Statement": [{ "Effect": "Allow", "Principal": { "Service": "lambda.amazonaws.com" }, "Action": "sts:AssumeRole" }]
}
```

## Inline policy `doorstep-demo-read-only`
Read records and snapshots, and call one Bedrock model. Nothing can be written.
```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Sid": "ReadRecords", "Effect": "Allow", "Action": ["dynamodb:GetItem", "dynamodb:Query"],
      "Resource": "arn:aws:dynamodb:<region>:<account-id>:table/doorstep-copilot" },
    { "Sid": "ReadSnapshots", "Effect": "Allow", "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::doorstep-copilot-snapshots-<account-id>/snapshots/*" },
    { "Sid": "AskWithNova", "Effect": "Allow", "Action": ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
      "Resource": [
        "arn:aws:bedrock:<region>:<account-id>:inference-profile/us.amazon.nova-2-lite-v1:0",
        "arn:aws:bedrock:*::foundation-model/amazon.nova-2-lite-v1:0"
      ] }
  ]
}
```
Plus the AWS managed `AWSLambdaBasicExecutionRole` for CloudWatch Logs.

## Commands
```bash
aws iam create-role --role-name doorstep-demo-lambda --assume-role-policy-document file://trust.json
aws iam attach-role-policy --role-name doorstep-demo-lambda --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
aws iam put-role-policy --role-name doorstep-demo-lambda --policy-name doorstep-demo-read-only --policy-document file://demo-policy.json
```
