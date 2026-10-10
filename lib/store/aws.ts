// DynamoDB for records (pk = kind, sk = id) and S3 for snapshots.

import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import type { DeliveryRecord, DoorEvent, Expectation, LockState } from '../types'
import { filterAndSort, type ListOptions, type Store } from './types'

export class AwsStore implements Store {
  readonly kind = 'aws' as const
  private ddb: DynamoDBDocumentClient
  private s3: S3Client

  constructor(
    private table: string,
    private bucket: string,
    region: string,
  ) {
    this.ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region }), {
      marshallOptions: { removeUndefinedValues: true },
    })
    this.s3 = new S3Client({ region })
  }

  private async get<T>(pk: string, sk: string): Promise<T | undefined> {
    const res = await this.ddb.send(new GetCommand({ TableName: this.table, Key: { pk, sk } }))
    return res.Item?.data as T | undefined
  }
  private async put(pk: string, sk: string, data: unknown) {
    await this.ddb.send(new PutCommand({ TableName: this.table, Item: { pk, sk, data } }))
  }
  private async all<T>(pk: string): Promise<T[]> {
    const items: T[] = []
    let ExclusiveStartKey: Record<string, any> | undefined
    do {
      const res = await this.ddb.send(
        new QueryCommand({
          TableName: this.table,
          KeyConditionExpression: 'pk = :pk',
          ExpressionAttributeValues: { ':pk': pk },
          ExclusiveStartKey,
        }),
      )
      for (const i of res.Items || []) items.push(i.data as T)
      ExclusiveStartKey = res.LastEvaluatedKey
    } while (ExclusiveStartKey && items.length < 2000)
    return items
  }

  getEvent(id: string) {
    return this.get<DoorEvent>('EVENT', id)
  }
  putEvent(event: DoorEvent) {
    return this.put('EVENT', event.id, event)
  }
  async listEvents(opts?: ListOptions) {
    return filterAndSort(await this.all<DoorEvent>('EVENT'), opts)
  }
  async putSnapshot(eventId: string, bytes: Buffer, contentType: string) {
    await this.s3.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: `snapshots/${eventId}`, Body: bytes, ContentType: contentType }),
    )
  }
  async getSnapshot(eventId: string) {
    try {
      const res = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: `snapshots/${eventId}` }))
      const bytes = Buffer.from(await res.Body!.transformToByteArray())
      return { bytes, contentType: res.ContentType || 'image/jpeg' }
    } catch (err: any) {
      if (err?.name === 'NoSuchKey') return undefined
      throw err
    }
  }
  getDelivery(id: string) {
    return this.get<DeliveryRecord>('DELIVERY', id)
  }
  putDelivery(delivery: DeliveryRecord) {
    return this.put('DELIVERY', delivery.id, delivery)
  }
  async listDeliveries(limit = 100) {
    return filterAndSort(await this.all<DeliveryRecord>('DELIVERY'), { limit })
  }
  getLock() {
    return this.get<LockState>('LOCK', 'parcel-box')
  }
  putLock(lock: LockState) {
    return this.put('LOCK', 'parcel-box', lock)
  }
  getExpectation(id: string) {
    return this.get<Expectation>('EXPECT', id)
  }
  putExpectation(expectation: Expectation) {
    return this.put('EXPECT', expectation.id, expectation)
  }
  async listExpectations(limit = 100) {
    return filterAndSort(await this.all<Expectation>('EXPECT'), { limit })
  }
}
