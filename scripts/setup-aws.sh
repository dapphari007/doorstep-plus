#!/usr/bin/env bash
# Creates the DynamoDB table and private S3 bucket used by Doorstep Copilot.
# Usage: ./scripts/setup-aws.sh [region]   (needs `aws login` or credentials)
set -euo pipefail

REGION="${1:-us-east-1}"
TABLE="doorstep-copilot"
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
BUCKET="doorstep-copilot-snapshots-${ACCOUNT}"

if aws dynamodb describe-table --region "$REGION" --table-name "$TABLE" >/dev/null 2>&1; then
  echo "Table $TABLE already exists"
else
  aws dynamodb create-table --region "$REGION" --table-name "$TABLE" \
    --attribute-definitions AttributeName=pk,AttributeType=S AttributeName=sk,AttributeType=S \
    --key-schema AttributeName=pk,KeyType=HASH AttributeName=sk,KeyType=RANGE \
    --billing-mode PAY_PER_REQUEST >/dev/null
  aws dynamodb wait table-exists --region "$REGION" --table-name "$TABLE"
  echo "Created table $TABLE"
fi

if aws s3api head-bucket --bucket "$BUCKET" >/dev/null 2>&1; then
  echo "Bucket $BUCKET already exists"
else
  if [ "$REGION" = "us-east-1" ]; then
    aws s3api create-bucket --region "$REGION" --bucket "$BUCKET" >/dev/null
  else
    aws s3api create-bucket --region "$REGION" --bucket "$BUCKET" \
      --create-bucket-configuration LocationConstraint="$REGION" >/dev/null
  fi
  aws s3api put-public-access-block --bucket "$BUCKET" --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
  echo "Created private bucket $BUCKET"
fi

echo
echo "Add to .env.local:"
echo "DDB_TABLE=$TABLE"
echo "S3_BUCKET=$BUCKET"
