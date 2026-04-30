export interface KalshiClientOptions {
  baseUrl?: string
  apiKey?: string | null
}

export interface KalshiRequestOptions {
  query?: Record<string, string | number | boolean | null | undefined>
  signal?: AbortSignal
}

export class KalshiClient {
  private readonly baseUrl: string
  private readonly apiKey: string | null

  constructor(options: KalshiClientOptions = {}) {
    this.baseUrl = String(
      options.baseUrl || process.env.KALSHI_API_BASE_URL || 'https://api.elections.kalshi.com/trade-api/v2',
    ).replace(/\/+$/, '')
    this.apiKey = options.apiKey ?? process.env.KALSHI_API_KEY ?? null
  }

  async getJson<T>(path: string, options: KalshiRequestOptions = {}): Promise<T> {
    const url = this.buildUrl(path, options.query)
    const response = await fetch(url, {
      method: 'GET',
      headers: this.headers(),
      signal: options.signal,
    })

    if (!response.ok) {
      throw new Error(`Kalshi request failed: ${response.status} ${response.statusText}`)
    }

    return (await response.json()) as T
  }

  private buildUrl(path: string, query?: KalshiRequestOptions['query']): string {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`
    const url = new URL(`${this.baseUrl}${normalizedPath}`)
    for (const [key, value] of Object.entries(query || {})) {
      if (value == null) continue
      url.searchParams.set(key, String(value))
    }
    return url.toString()
  }

  private headers(): HeadersInit {
    return {
      accept: 'application/json',
      ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
    }
  }
}
