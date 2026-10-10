import { NextResponse } from 'next/server'
import { config, hasAwsCredentials, hasRingAuth } from '@/lib/config'
import { getAuthMode, hasRuntimeAccessToken } from '@/lib/ring/auth'
import { pollerStatus } from '@/lib/ring/poller'
import { getStore } from '@/lib/store'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    fixtures: config.fixtures,
    demo: config.demo,
    ring: {
      connected: hasRingAuth() || hasRuntimeAccessToken(),
      mode: getAuthMode(),
      runtimeToken: hasRuntimeAccessToken(),
      webhookVerification: !!config.ring.webhookSigningKey,
    },
    aws: {
      credentials: hasAwsCredentials(),
      region: config.aws.region,
      perceptionModel: config.aws.perceptionModel,
      agentModel: config.aws.agentModel,
      store: getStore().kind,
    },
    poller: pollerStatus(),
    lightWebhook: !!config.lightWebhookUrl,
    timezone: config.timezone,
  })
}
