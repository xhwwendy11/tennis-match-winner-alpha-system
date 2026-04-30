import { extractMatchByUrl } from '../app/extractMatchByUrl.js'

function usage(): never {
  console.error('Usage: tsx src/cli/extractSnapshot.ts <flashscore-match-url> [market-url]')
  process.exit(1)
}

export async function main(argv = process.argv): Promise<void> {
  const rawUrl = argv[2]
  const marketUrl = argv[3] || null
  if (!rawUrl) usage()

  const result = await extractMatchByUrl(rawUrl, {
    kalshiMarketUrl: marketUrl?.includes('kalshi.com') ? marketUrl : null,
    polymarketMarketUrl: marketUrl?.includes('polymarket.com') ? marketUrl : null,
  })
  console.log(JSON.stringify(result.decisionSnapshot, null, 2))
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: message,
      },
      null,
      2,
    ),
  )
  process.exit(1)
})
