// Global In-Memory Client Cache Store & Prefetcher for 0ms Instant Page Transitions

type CacheListener = () => void

class ClientCacheStore {
  private cache = new Map<string, { data: any; timestamp: number }>()
  private listeners = new Map<string, Set<CacheListener>>()
  private inflight = new Map<string, Promise<any>>()
  private prefetched = false

  get<T = any>(key: string): T | null {
    const entry = this.cache.get(key)
    return entry ? entry.data : null
  }

  set(key: string, data: any) {
    this.cache.set(key, { data, timestamp: Date.now() })
    const subs = this.listeners.get(key)
    if (subs) {
      subs.forEach(cb => cb())
    }
  }

  delete(key: string) {
    this.cache.delete(key)
    const subs = this.listeners.get(key)
    if (subs) {
      subs.forEach(cb => cb())
    }
  }

  subscribe(key: string, callback: CacheListener) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set())
    }
    this.listeners.get(key)!.add(callback)
    return () => {
      this.listeners.get(key)?.delete(callback)
    }
  }

  async fetchWithCache<T = any>(
    key: string,
    url: string,
    options?: { maxAgeMs?: number; force?: boolean }
  ): Promise<T> {
    const maxAge = options?.maxAgeMs ?? 60_000 // 1 minute default freshness
    const cached = this.cache.get(key)

    // If cache is fresh and not forced, return immediately
    if (cached && !options?.force && Date.now() - cached.timestamp < maxAge) {
      return cached.data as T
    }

    // Deduplicate in-flight requests for the same URL/key
    if (this.inflight.has(key)) {
      return this.inflight.get(key)!
    }

    const promise = fetch(url)
      .then(async res => {
        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`)
        const data = await res.json()
        this.set(key, data)
        return data as T
      })
      .finally(() => {
        this.inflight.delete(key)
      })

    this.inflight.set(key, promise)
    return promise
  }

  invalidate(keyPrefix?: string) {
    if (!keyPrefix) {
      this.cache.clear()
    } else {
      for (const key of this.cache.keys()) {
        if (key.startsWith(keyPrefix)) {
          this.cache.delete(key)
        }
      }
    }
  }

  // Pre-warms the cache right after login so every page opens instantly in 0ms
  prefetchCoreData(isAdmin: boolean) {
    if (this.prefetched) return
    this.prefetched = true

    const tasks: Promise<any>[] = [
      this.fetchWithCache('invoices_all', '/api/invoices?limit=500'),
      this.fetchWithCache('customers_all', '/api/customers'),
      this.fetchWithCache('quotations_all', '/api/quotations?limit=500'),
      this.fetchWithCache('expenses_all', '/api/expenses?limit=1000'),
      this.fetchWithCache('statements_all', '/api/statements'),
      this.fetchWithCache('settings_data', '/api/settings'),
      this.fetchWithCache('pricing_data', '/api/pricing'),
    ]

    if (isAdmin) {
      tasks.push(this.fetchWithCache('dashboard_data', '/api/dashboard'))
    }

    Promise.allSettled(tasks)
  }
}

export const clientCache = new ClientCacheStore()
