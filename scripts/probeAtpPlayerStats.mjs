import { chromium } from 'playwright-core'

const pageUrl = process.argv[2]

if (!pageUrl) {
  console.error('Usage: node scripts/probeAtpPlayerStats.mjs "<atp player-stats url>"')
  process.exit(1)
}

const CHROME_EXECUTABLE_PATH =
  process.env.FLASHSCORE_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

function summarizeScripts(html) {
  const interesting = []
  const patterns = [
    /__NEXT_DATA__/i,
    /window\.__/i,
    /playerData/i,
    /graphql/i,
    /api\//i,
    /application\/ld\+json/i,
  ]

  const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi
  let match
  while ((match = scriptRegex.exec(html))) {
    const body = String(match[1] || '').trim()
    if (!body) continue
    if (!patterns.some((pattern) => pattern.test(body))) continue
    interesting.push(body.slice(0, 400))
    if (interesting.length >= 8) break
  }
  return interesting
}

function interestingRequest(url, resourceType) {
  if (!url) return false
  return (
    resourceType === 'fetch' ||
    resourceType === 'xhr' ||
    /graphql|api\/|\.json\b|player|stats|rank/i.test(url)
  )
}

async function main() {
  const browser = await chromium.launch({
    executablePath: CHROME_EXECUTABLE_PATH,
    headless: true,
    args: ['--no-sandbox'],
  })

  const requests = []
  const responses = []
  let page = null

  try {
    page = await browser.newPage()

    page.on('request', (request) => {
      const url = request.url()
      const resourceType = request.resourceType()
      if (!interestingRequest(url, resourceType)) return
      requests.push({
        method: request.method(),
        resourceType,
        url,
      })
    })

    page.on('response', async (response) => {
      const request = response.request()
      const url = response.url()
      const resourceType = request.resourceType()
      if (!interestingRequest(url, resourceType)) return

      let bodyPreview = null
      const contentType = String(response.headers()['content-type'] || '')
      if (/json|javascript|text\//i.test(contentType)) {
        try {
          const text = await response.text()
          bodyPreview = text.slice(0, 300)
        } catch {}
      }

      responses.push({
        status: response.status(),
        resourceType,
        url,
        contentType: contentType || null,
        bodyPreview,
      })
    })

    await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.waitForTimeout(6_000)

    const title = await page.title()
    const html = await page.content()
    const bodyText = await page.locator('body').innerText()

    console.log(
      JSON.stringify(
        {
          ok: true,
          pageUrl,
          title,
          bodyPreview: bodyText.slice(0, 1200),
          scriptHints: summarizeScripts(html),
          requests,
          responses,
        },
        null,
        2,
      ),
    )
  } finally {
    await page?.close().catch(() => {})
    await browser.close().catch(() => {})
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

