#!/usr/bin/env bash
# Rebuilds the read-only demo image and updates the Lambda function.
# First-time setup (repo, role, function, URL) is described in README "Live demo".
# Usage: ./scripts/deploy-demo.sh   (needs Docker and `aws login`)
set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
FUNCTION="doorstep-demo"
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
REGISTRY="${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com"
IMAGE="${REGISTRY}/doorstep-demo:$(git rev-parse --short HEAD)-demo"

aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$REGISTRY" >/dev/null
docker buildx build --platform linux/arm64 --provenance=false --sbom=false -f Dockerfile.lambda -t "$IMAGE" --push .
aws lambda update-function-code --region "$REGION" --function-name "$FUNCTION" --image-uri "$IMAGE" >/dev/null
aws lambda wait function-updated-v2 --region "$REGION" --function-name "$FUNCTION"
echo "Deployed $IMAGE"
aws lambda get-function-url-config --region "$REGION" --function-name "$FUNCTION" --query FunctionUrl --output text
