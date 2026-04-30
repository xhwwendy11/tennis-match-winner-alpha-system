import { extractMatchByUrl } from '../app/extractMatchByUrl.js'

function usage(): never {
  console.error('Usage: tsx src/cli/extractByUrl.ts <flashscore-match-url> [kalshi-market-url]')
  process.exit(1)
}

export async function main(argv = process.argv): Promise<void> {
  const rawUrl = argv[2]
  const kalshiMarketUrl = argv[3] || null
  if (!rawUrl) usage()

  const result = await extractMatchByUrl(rawUrl, { kalshiMarketUrl })
  console.log(JSON.stringify(result, null, 2))
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
