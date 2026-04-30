const pageUrl = process.argv[2]

if (!pageUrl) {
  console.error('Usage: node scripts/probeFlashscoreTennisFeeds.mjs "<flashscore tennis match url>"')
  process.exit(1)
}

function absoluteUrl(url) {
  return /^https?:\/\//i.test(url) ? url : `https://www.flashscore.com${url}`
}

function extractWindowEnvironment(html) {
  const anchor = 'window.environment = '
  const start = html.indexOf(anchor)
  if (start < 0) return null
  const jsonStart = html.indexOf('{', start)
  if (jsonStart < 0) return null

  let depth = 0
  let inString = false
  let escaped = false
  let jsonEnd = -1

  for (let i = jsonStart; i < html.length; i += 1) {
    const ch = html[i]
    if (inString) {
      if (escaped) {
        escaped = false
        continue
      }
      if (ch === '\\') {
        escaped = true
        continue
      }
      if (ch === '"') {
        inString = false
      }
      continue
    }
    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === '{') {
      depth += 1
      continue
    }
    if (ch === '}') {
      depth -= 1
      if (depth === 0) {
        jsonEnd = i + 1
        break
      }
    }
  }

  if (jsonEnd < 0) return null

  try {
    return JSON.parse(html.slice(jsonStart, jsonEnd))
  } catch {
    return null
  }
}

async function fetchText(url, headers) {
  const response = await fetch(url, {
    headers,
    redirect: 'follow',
  })
  const text = await response.text()
  return {
    status: response.status,
    text,
  }
}

async function main() {
  const htmlResponse = await fetchText(pageUrl, {
    Accept: 'text/html,application/xhtml+xml',
    'User-Agent': 'Mozilla/5.0',
  })

  const env = extractWindowEnvironment(htmlResponse.text)
  if (!env) {
    console.log(JSON.stringify({ ok: false, reason: 'missing_window_environment' }, null, 2))
    return
  }

  const eventId = String(env.event_id_c || '').trim()
  const projectId = String(env.project_id || env?.config?.app?.project?.id || env?.config?.project?.id || '').trim()
  const feedSign = String(env?.config?.app?.feed_sign || env?.config?.feed_sign || '').trim()
  const referer = env.basenameUrl ? absoluteUrl(`${String(env.basenameUrl).replace(/\/+$/, '')}/`) : pageUrl

  const candidateFeeds = [
    `df_sui_${projectId}_${eventId}`,
    `df_st_${projectId}_${eventId}`,
    `df_st_2_${eventId}`,
    `df_sui_2_${eventId}`,
  ]

  const feedResults = []
  for (const feed of candidateFeeds) {
    const response = await fetchText(absoluteUrl(`/x/feed/${feed}`), {
      Accept: 'text/plain, */*',
      'Cache-Control': 'no-cache',
      Referer: referer,
      'User-Agent': 'Mozilla/5.0',
      'x-fsign': feedSign,
    })

    feedResults.push({
      feed,
      status: response.status,
      length: response.text.length,
      head: response.text.slice(0, 250),
    })
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        eventId,
        projectId,
        hasFeedSign: !!feedSign,
        referer,
        feeds: feedResults,
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
