import { existsSync } from 'fs'
import { homedir } from 'os'
import path from 'path'


function num(name: string, fallback: number): number {
  const raw = process.env[name]
  const parsed = raw ? Number(raw) : NaN
  return Number.isFinite(parsed) ? parsed : fallback
}

export const config = {
  ring: {
    apiBase: process.env.RING_API_BASE || 'https://api.amazonvision.com',
    deviceId: process.env.RING_DEVICE_ID || undefined,
    webhookSigningKey: process.env.RING_WEBHOOK_SIGNING_KEY || undefined,
  },
  poller: {
    enabled: process.env.POLLER_ENABLED !== 'false',
    intervalMs: num('POLL_INTERVAL_MS', 4000),
    // How many already-existing events to describe on first boot.
    backfill: num('POLL_BACKFILL', 5),
  },
  aws: {
    region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1',
    perceptionModel: process.env.PERCEPTION_MODEL_ID || 'us.amazon.nova-2-lite-v1:0',
    agentModel: process.env.AGENT_MODEL_ID || 'us.amazon.nova-2-lite-v1:0',
    dynamoTable: process.env.DDB_TABLE || undefined,
    s3Bucket: process.env.S3_BUCKET || undefined,
  },
  // Fixture mode fakes Ring and Bedrock for UI work; fixture events are labelled in the UI.
  fixtures: process.env.FIXTURE_MODE === 'true',
  lightWebhookUrl: process.env.LIGHT_WEBHOOK_URL || undefined,
  dataDir: process.env.DATA_DIR || '.data',
  timezone: process.env.HOME_TIMEZONE || 'America/Los_Angeles',
}

export function hasRingAuth(): boolean {
  return !!(process.env.RING_ACCESS_TOKEN || process.env.RING_REFRESH_TOKEN)
}

export function hasAwsCredentials(): boolean {
  return !!(
    process.env.AWS_ACCESS_KEY_ID ||
    process.env.AWS_PROFILE ||
    process.env.AWS_BEARER_TOKEN_BEDROCK ||
    process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI ||
    process.env.AWS_WEB_IDENTITY_TOKEN_FILE ||
    // `aws configure`, `aws login` and SSO all keep credentials under ~/.aws
    existsSync(path.join(homedir(), '.aws'))
  )
}
