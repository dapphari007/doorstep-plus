'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { DemoAlertCard } from './components/DemoAlertCard'
import { EventRow } from './components/EventRow'
import { ExpectedCard } from './components/ExpectedCard'
import { LiveViewCard } from './components/LiveViewCard'
import { Button } from './components/ui/Button'
import { Container, PageHeader, SectionTitle } from './components/ui/Card'
import { EmptyState } from './components/ui/EmptyState'
import { useNow } from './hooks/useNow'
import { useApp } from './providers/AppProvider'
import { FEED_FILTERS, groupByDay, matchesFilter, visibleEvents, type FeedFilter } from './utils/feed'
import { errorMessage, postJson } from './utils/format'
import { PROFILES } from './utils/profiles'

const PAGE_SIZE = 15

export default function HomePage() {
  const { events, loaded, profile, status, reloadStatus } = useApp()
  const now = useNow(30_000)
  const [shown, setShown] = useState(PAGE_SIZE)
  const [checking, setChecking] = useState(false)
  const [checkError, setCheckError] = useState<string>()
  const [filter, setFilter] = useState<FeedFilter>('all')

  const feed = useMemo(() => visibleEvents(events).filter((e) => matchesFilter(e, filter)), [events, filter])
  const groups = useMemo(() => groupByDay(feed.slice(0, shown), now), [feed, shown, now])

  const ringConnected = !!status?.ring.connected
  const fixtures = !!status?.fixtures

  const checkNow = async () => {
    setChecking(true)
    setCheckError(undefined)
    try {
      await postJson('/api/ring/poll', {})
      await reloadStatus()
    } catch (err) {
      setCheckError(errorMessage(err, 'Could not check Ring'))
    } finally {
      setChecking(false)
    }
  }

  return (
    <>
      <Container>
        <PageHeader title="Front door" />
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] xl:gap-16">
          <div className="min-w-0 space-y-6">
            <section aria-labelledby="live-heading">
              {status?.demo ? <DemoAlertCard /> : <LiveViewCard ringConnected={ringConnected} fixtures={fixtures} />}
            </section>
            <ExpectedCard now={now} />
          </div>

          <section aria-labelledby="activity-heading" className="min-w-0">
            <SectionTitle
              id="activity-heading"
              action={
                ringConnected && !fixtures ? (
                  <Button variant="ghost" size="sm" icon="refresh" loading={checking} onClick={checkNow}>
                    Check now
                  </Button>
                ) : undefined
              }
            >
              Activity
            </SectionTitle>
            <p className="-mt-2 mb-3 text-sm text-muted">
              Alerts set for{' '}
              <Link href="/settings" className="font-medium text-primary hover:underline">
                {PROFILES[profile].label}
              </Link>
            </p>
            <div
              role="group"
              aria-label="Filter activity"
              className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {FEED_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={filter === f.id}
                  onClick={() => {
                    setFilter(f.id)
                    setShown(PAGE_SIZE)
                  }}
                  className={`h-8 shrink-0 rounded-full border px-3.5 text-sm font-medium transition-colors ${
                    filter === f.id
                      ? 'border-primary bg-primary text-primary-on'
                      : 'border-line text-muted hover:border-primary hover:text-primary'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {checkError && (
              <p role="alert" className="mb-3 text-sm text-danger">
                {checkError}
              </p>
            )}

            {!loaded ? (
              <div className="space-y-3" aria-hidden="true">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-16 animate-pulse rounded-xl bg-subtle" />
                ))}
              </div>
            ) : feed.length === 0 ? (
              <EmptyState
                icon="door"
                title={
                  filter === 'all'
                    ? 'No activity yet'
                    : `Nothing under ${FEED_FILTERS.find((f) => f.id === filter)?.label} yet`
                }
              >
                {filter === 'all' ? 'Events from your doorbell will show up here.' : 'Try another filter, or All.'}
              </EmptyState>
            ) : (
              <>
                {groups.map((group) => (
                  <section key={group.day} aria-label={group.day} className="mt-4 first:mt-0">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{group.day}</h3>
                    <ul className="divide-y divide-line">
                      {group.events.map((e) => (
                        <li key={e.id}>
                          <EventRow event={e} now={now} />
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
                {feed.length > shown && (
                  <Button variant="secondary" block className="mt-4" onClick={() => setShown((n) => n + PAGE_SIZE)}>
                    Show more
                  </Button>
                )}
                <Link
                  href="/ask"
                  className="mt-6 inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                >
                  Ask about your door's history
                </Link>
              </>
            )}
          </section>
        </div>
      </Container>
    </>
  )
}
