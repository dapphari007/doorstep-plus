import { config } from '../config'
import { AwsStore } from './aws'
import { LocalStore } from './local'
import type { Store } from './types'

const g = globalThis as unknown as { __doorstepStore?: Store }

/** One store per server process (survives Next.js hot reloads in dev). */
export function getStore(): Store {
  if (!g.__doorstepStore) {
    const { dynamoTable, s3Bucket, region } = config.aws
    g.__doorstepStore =
      dynamoTable && s3Bucket && !config.fixtures
        ? new AwsStore(dynamoTable, s3Bucket, region)
        : new LocalStore(config.dataDir)
  }
  return g.__doorstepStore
}

export type { Store } from './types'
