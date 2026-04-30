## Tennis Match Winner Alpha System

Tennis Match Winner Alpha System is a tennis-only live trading system project.

The project is organized around a 5-layer architecture:
1. Layer 1: canonical live match state
2. Layer 2: `pFair` probability and risk engine
3. Layer 3: continuous state / hidden-state / regime tracking
4. Layer 4: market mapping, dislocation, and multi-market comparison
5. Layer 5: execution, sizing, and portfolio synthesis

The project is no longer just a live score scraper or a winner-probability model.
It now supports an end-to-end chain:
- Flashscore live state
- official / historical prematch baseline
- `pFair`
- `fair vs Kalshi`
- `fair vs Polymarket`
- `Kalshi vs Polymarket`
- setup classification
- execution ranking and shortlist
- regime-conditioned execution policy
- position sizing
- resolved execution audit
- portfolio risk budget
- portfolio audit
- policy segment audit

## Current Scope

The project already includes:
- Flashscore tennis live extraction
- serve-side resolution with `dom / retry / unknown`
- `pointRisk` rule engine for best-of-3 live tennis
- abnormal-state hard-stop protection
- official and Flashscore-history prematch baseline sources
- `pFair` from point to game to set to match
- decision snapshots for replay and calibration
- Kalshi fair-vs-market comparison and edge signal
- Polymarket live market adapter
- Kalshi vs Polymarket single-match comparison
- repeated recapture path reports
- provider-aware market eligibility
- `liveDecision` and setup taxonomy
- execution dataset / labels / study / ranking / shortlist
- execution synthesis with regime policy and sizing policy
- resolved execution audit
- portfolio risk budget and portfolio audit
- policy segment audit
- outcome sidecars for post-match calibration

## Layer Status

### Layer 1
Implemented:
- Flashscore live match state
- serve-side resolution
- stats extraction
- decision snapshots
- prematch baseline ingestion from ATP / WTA / ITF / Flashscore history

Still incomplete:
- denser automated live sampling
- stronger latency / stale-source instrumentation

### Layer 2
Implemented:
- `pFair` from point -> game -> set -> match
- official and fallback baseline policy
- calibration reports and candidate reports

Still incomplete:
- larger resolved sample by segment
- more parameter tuning by tour / quality bucket

### Layer 3
Implemented:
- repeated recapture paths
- regime tagging in final execution synthesis
- path-aware execution gating

Still incomplete:
- richer hidden-state / alpha-pattern modeling
- stronger continuous-state features beyond current path summaries

### Layer 4
Implemented:
- `fair vs Kalshi`
- `fair vs Polymarket`
- `Kalshi vs Polymarket`
- provider deviation reports
- resolved cross-market study
- setup taxonomy and setup-outcome study

Still incomplete:
- larger resolved multi-market sample
- stronger historical provider-specific segment conclusions

### Layer 5
Implemented:
- execution dataset
- fill / adverse label scaffolding from future recapture paths
- execution ranking
- execution shortlist
- execution synthesis
- regime-conditioned execution policy
- position sizing policy
- resolved execution audit
- portfolio risk budget
- portfolio audit
- policy segment audit

Still incomplete:
- more samples for policy tuning
- denser fill-quality evidence
- production-grade execution / queue / book modeling

## Structure

- `src/foundation`
  shared state objects and future system primitives
- `src/kalshi`
  Kalshi market data types and future API clients
- `src/realtime-score/tennis`
  Flashscore tennis ingestion, parsing, and serve resolution
- `src/rules/tennis`
  current rule engine and trade plan logic
- `src/app`
  application orchestration
- `src/cli`
  command-line entrypoint

## First Build Direction

The first system-level step is to stabilize and expand:
- `src/foundation/canonicalMatchState.ts`
- `src/foundation/canonicalMarketState.ts`
- `src/foundation/prematchBaseline.ts`
- `src/foundation/prematchBaselineBuilder.ts`
- `src/foundation/playerMapping.ts`
- `src/foundation/prematchBaselineProvider.ts`
- `src/probability/probabilityState.ts`

This object should become the common language across:
- match-state ingestion
- risk logic
- future fair-probability logic
- alpha-pattern detection
- execution policy

The probability and risk output layer is now initialized as a structured output layer:
- baseline schema is defined
- `prematchBaseline` can be injected into the app entrypoint
- `prematchBaseline` can also be built automatically from player mapping + ATP/WTA/ITF clients
- `probabilityState` is returned by the app
- `pFair` now exposes a full `point -> game -> set -> match` fair-probability structure
- `decisionSnapshot` is returned by the app for replay, calibration, and source-level debugging
- `decisionSnapshot` now also carries `fairVsMarket` when a Kalshi market state is available
- current `pointRisk` is preserved and exposed through structured probability-state risk/context fields

The current source split is:
- Flashscore -> `canonicalMatchState`
- Kalshi -> `canonicalMarketState`
- ATP Tour JSON endpoints -> ATP prematch baseline source
- WTA official API -> WTA prematch baseline source
- ITF official endpoints -> ITF prematch baseline source

The first ATP baseline files are:
- `src/atp/client.ts`
- `src/atp/types.ts`

The first WTA baseline files are:
- `src/wta/client.ts`
- `src/wta/types.ts`

The first ITF baseline files are:
- `src/itf/client.ts`
- `src/itf/types.ts`

Confirmed ATP player JSON endpoints:
- `/en/-/www/players/hero/{playerId}?v=1`
- `/en/-/www/stats/{playerId}/all/all?v=1`

Confirmed WTA player JSON endpoint:
- `https://api.wtatennis.com/tennis/players/{playerId}/year/{year}`

Confirmed ITF player JSON endpoints:
- `/tennis/api/PlayerApi/GetPlayerOverview?playerId={playerId}&circuitCode={code}&matchTypeCode={code}`
- `/tennis/api/PlayerApi/GetPlayerWinLoss?playerId={playerId}&circuitCode={code}&matchTypeCode={code}&year={year}`

`canonicalMatchState` now carries the Layer 1 core buckets:
- source metadata
- competition and participant metadata
- scoreboard state
- serve state
- quality / integrity state
- live-stats placeholders
- ingestion timestamps

The first Kalshi market layer files are:
- `src/kalshi/client.ts`
- `src/kalshi/marketClient.ts`
- `src/kalshi/types.ts`

The first Polymarket historical-data adapter files are:
- `src/polymarket/types.ts`
- `src/polymarket/historicalData.ts`
- `src/polymarket/priceSeries.ts`

Polymarket historical-data policy:
- Polymarket is treated as a Layer 4/5 historical market-data source, not a replacement for Kalshi live capture
- public datasets such as Hugging Face `SII-WANGZJ/Polymarket_data` can provide market metadata, settled outcomes, and trade/YES-price history
- the project expects exported local rows from `markets.parquet` and `quant.parquet` / `trades.parquet`
- `markets.parquet` is useful for filtering tennis markets and reading final outcome prices
- `quant.parquet` is useful for normalized YES-price time series
- direct full-dataset downloads are intentionally not part of the live flow because public Polymarket datasets can be very large
- tennis market matching is best-effort from question/event text and must be validated before using it for production backtests
- use `scan:polymarket` after exporting a local JSON / JSONL / CSV slice from Hugging Face parquet files
- use `aggregate:polymarket` to convert exported trade rows into one compact price summary row per tennis match-winner market
- keep `data/polymarket/processed/polymarket-tennis-match-winner-markets.jsonl` as the useful compact metadata slice
- keep `data/polymarket/processed/polymarket-tennis-match-winner-market-ids.txt` for filtering large price/trade parquet files
- keep `data/polymarket/processed/polymarket-tennis-match-winner-quant.jsonl` when full historical trade rows are needed
- keep `data/polymarket/processed/polymarket-tennis-match-winner-price-series.jsonl` as the compact market-history summary for Layer 4/5 work
- `data/polymarket/raw/markets.parquet` can be deleted after the compact metadata slice is regenerated and verified
- `data/polymarket/raw/quant.parquet` can be deleted after the compact trade slice and price-series summary are regenerated and verified
- `data/polymarket/markets-tennis.jsonl` is an intermediate broad tennis slice and can be deleted after the match-winner slice is verified
- current exported `quant.parquet` rows do not include an outcome-token id, so aggregated trade prices are labeled `reported_trade_price_not_player_mapped`; do not treat them as player A / player B probabilities without additional token-side mapping

Stats source policy:
- display-aligned tennis stats prefer `kalshi_ui` when present
- missing display fields fall back to `flashscore`
- disputed fields like `break points` keep lower confidence even when sourced from Kalshi

Prematch baseline source policy:
- ATP / ATP Challenger -> prefer ATP source
- WTA / WTA Challenger -> prefer WTA source
- ITF -> prefer ITF source
- if official baseline is missing, use cached Flashscore history when available
- if no official or Flashscore-history baseline is available, fall back to market implied probabilities or live-state-driven logic

Player identity resolution policy:
- local `playerDirectory` remains the primary identity cache
- ATP now supports first-pass automatic discovery via the official singles rankings JSON
- WTA now supports first-pass automatic discovery via the official players page
- ITF now supports a best-effort official discovery pass via player-profile links when the players page is accessible
- discovered ATP mappings can be written back into the local directory cache
- ATP / WTA / ITF are now first-class discovery slots in the resolver boundary
- ATP and WTA have concrete automatic discovery implementations today
- ITF discovery is best-effort and can return no result when the official players page is anti-bot blocked

Baseline freshness policy:
- `playerDirectory` stores identity only
- player baseline data is time-sensitive and should be cached separately
- ATP / WTA / ITF baseline fetches now support a dedicated `baselineCache`
- `sourceId` should be reused long-term; baseline stats should be refreshed or short-term cached
- Flashscore historical baseline is intentionally prefetch-only for live usage
- `capture:snapshot` reads Flashscore-history cache only, so live capture does not slow-crawl player history

Snapshot quality policy:
- `high`: official baseline, live server side, pFair, and live stats are available
- `medium`: Flashscore-history baseline with live server/stats, or official baseline with score-only state
- `low`: fallback baseline or incomplete inputs that are still useful for observation
- `unusable`: final/non-live state, missing server side for live state, missing pFair, or unsupported doubles

Edge signal policy:
- `fairVsMarket` compares pFair against Kalshi market probabilities
- `edgeSignal` uses the strongest absolute edge versus Kalshi `last`
- low-quality snapshots are `watch_only`
- unusable snapshots are `ignore`
- only medium/high quality with medium/strong edge becomes `candidate`

Outcome / calibration policy:
- live snapshots are stored as point-in-time evidence
- final match results are stored separately as `resolved-match-outcome/v1` sidecars
- calibration joins snapshots with outcome sidecars by Flashscore match id or match URL
- this keeps live capture immutable while still allowing post-match calibration

P-fair calibration policy:
- raw `pFair` remains the model's unmodified probability
- `pFairCalibration` learns conservative bucket-level bias adjustments from resolved snapshots
- adjustments are shrunk by sample size through `priorStrength`
- adjustments are capped by `maxAdjustment`
- calibrated pFair is report/output layer only for now; it does not overwrite stored snapshots
- current calibration results are in-sample diagnostics, not proof of tradable edge

Execution / `p_fill` policy:
- `pFair` answers "what is the fair win probability right now?"
- `p_fill` answers "if we quote here, how likely is it that the order gets filled?"
- `p_fill` is not implemented as a production model yet; it is a Layer 5 execution concept
- the intended v1 definition is:
  - given `side`, `price`, and current market state
  - estimate the probability that the order is fillable within a short future window
- the most practical execution definition is:
  - `p_fill_before_move`
  - probability that the order fills before the market moves away in an adverse direction
- a simpler bootstrap definition is:
  - `p_fill_snapshot_window`
  - probability that a later snapshot touches or crosses the quoted price
- `p_fill` should be modeled separately from `pFair`
- `p_fill` needs repeated market snapshots and ideally order-book or trade-print style history
- current project state provides the prerequisites for a future `p_fill` model:
  - repeated Kalshi market snapshots
  - fair-vs-market comparisons
  - point-in-time match state and risk phase
  - compact historical Polymarket market-path summaries
- `p_fill` should eventually combine:
  - side
  - quoted price
  - bid / ask / spread / last
  - phase (`non_tiebreak`, `tiebreak`, break-point pressure, etc.)
  - recent price movement
  - quality tier
  - time or point horizon

`p_fill` v1 design:
- objective:
  - estimate whether a hypothetical passive order would have been fillable shortly after a snapshot
- unit of prediction:
  - one snapshot + one quoted side + one quoted price + one short horizon
- recommended first target:
  - `p_fill_snapshot_window`
  - whether the order price is touched or crossed by a later market snapshot before horizon expiry
- recommended future target:
  - `p_fill_before_move`
  - whether the order fills before the market moves away in an adverse direction
- v1 inputs:
  - `fairProbA` / `fairProbB`
  - edge versus `last`
  - edge versus `ask`
  - edge versus `bid`
  - current `bid / ask / spread / last`
  - market side convention (`teamA` / `teamB`)
  - match phase
  - risk rule
  - quality tier
  - tour type
  - server side
  - score state (`setIndex`, games, points, tiebreak flag)
  - elapsed time to next snapshot if known
- v1 label construction:
  - choose an order hypothesis such as:
    - buy A at current `bid`
    - buy A at `bid + 0.01`
    - sell A at current `ask`
  - scan later snapshots in a short window
  - mark as fillable if market prices touch or improve through the quoted level
  - mark as not fillable if window ends first
- v1 limitations:
  - snapshot-touch is not the same as actual queue fill
  - no queue position
  - no order-book depth
  - no exact trade prints from Kalshi yet
  - cannot fully separate favorable fill from adverse-selection fill
- v1 practical use:
  - rank opportunities by both `edge` and approximate `p_fill`
  - suppress signals where edge is large but likely unfillable
  - distinguish "good idea but no fill" from "bad idea"
- suggested horizons:
  - next snapshot
  - 30 seconds
  - 60 seconds
  - before next point/state change
- suggested output fields:
  - `pFillBidA`
  - `pFillAskA`
  - `pFillBidB`
  - `pFillAskB`
  - `expectedEdgeIfFilled`
  - `fillRiskTag`
- v2 upgrade path:
  - add denser Kalshi sampling
  - add actual trade print or book data if available
  - model adverse selection separately from raw fill probability
  - condition fill by market regime such as tiebreaks and break-point pressure

Player directory format:
- use `player-directory.example.json` as the starting template
- use `player-directory.live-samples.json` only for temporary live-match mappings
- `source`
  - `atp`
  - `wta`
  - `itf`
- `sourcePlayerId`
  - official source player id
- `flashscorePlayerId`
  - optional Flashscore player id for the most reliable mapping
- `flashscoreSlug`
  - optional Flashscore slug fallback
- `fullName`
  - official player name
- `aliases`
  - optional alternate names / short names
- `meta`
  - optional extra source-specific fields
  - for ITF, use:
    - `circuitCode`
    - `matchTypeCode`

## Run

```bash
npm install
npm test
npm run extract -- "https://www.flashscore.com/match/tennis/..."
npm run extract -- "https://www.flashscore.com/match/tennis/..." "https://kalshi.com/markets/..."
npm run snapshot -- "https://www.flashscore.com/match/tennis/..."
npm run snapshot -- "https://www.flashscore.com/match/tennis/..." "https://kalshi.com/markets/..."
npm run capture:snapshot -- "https://www.flashscore.com/match/tennis/..."
npm run capture:snapshot -- "https://www.flashscore.com/match/tennis/..." "https://kalshi.com/markets/..."
npm run capture:snapshot -- "https://www.flashscore.com/match/tennis/..." "https://kalshi.com/markets/..." --player-directory ./player-directory.example.json
npm run capture:snapshot -- "https://www.flashscore.com/match/tennis/..." "https://kalshi.com/markets/..." --player-directory ./player-directory.live-samples.json
npm run baseline:prefetch -- "https://www.flashscore.com/match/tennis/..." --max-matches 8 --min-stat-matches 3
npm run resolve:outcomes -- "./snapshots" --outcomes "./data/outcomes/flashscore"
npm run report:calibration
npm run report:calibration -- "./snapshots"
npm run report:calibration -- "./snapshots" --outcomes "./data/outcomes/flashscore"
npm run report:pfair-calibration -- "./snapshots" --outcomes "./data/outcomes/flashscore"
npm run report:candidates -- "./snapshots" --outcomes "./data/outcomes/flashscore"
npm run report:tour-segments -- "./snapshots" --outcomes "./data/outcomes/flashscore"
npm run report:coverage
npm run report:coverage -- "./snapshots"
npm run compare:markets -- "https://www.flashscore.com/match/tennis/..." --kalshi-market-url "https://kalshi.com/markets/..." --polymarket-market-url "https://polymarket.com/sports/..."
npm run recapture:markets -- "https://www.flashscore.com/match/tennis/..." --kalshi-market-url "https://kalshi.com/markets/..." --polymarket-market-url "https://polymarket.com/sports/..." --interval-seconds 120 --iterations 5
npm run report:multi-market -- "./multi-market-comparisons" --outcomes "./data/outcomes/flashscore"
npm run report:provider-deviation -- "./multi-market-comparisons" --outcomes "./data/outcomes/flashscore"
npm run report:resolved-cross-market -- "./multi-market-comparisons" --outcomes "./data/outcomes/flashscore"
npm run report:recapture-paths -- "./multi-market-comparisons"
npm run report:setup-taxonomy -- "./multi-market-comparisons"
npm run report:setup-outcomes -- "./multi-market-comparisons" --outcomes "./data/outcomes/flashscore"
npm run report:execution-dataset -- "./multi-market-comparisons"
npm run report:labeled-execution-dataset -- "./multi-market-comparisons"
npm run report:execution-study -- "./multi-market-comparisons"
npm run report:execution-ranking -- "./multi-market-comparisons" --limit 25
npm run report:execution-shortlist -- "./multi-market-comparisons" --limit 25
npm run report:execution-synthesis -- "./multi-market-comparisons" --limit 25
npm run report:resolved-execution-audit -- "./multi-market-comparisons" --outcomes "./data/outcomes/flashscore" --limit 25
npm run report:portfolio-risk-budget -- "./multi-market-comparisons" --limit 25
npm run report:portfolio-audit -- "./multi-market-comparisons" --outcomes "./data/outcomes/flashscore" --limit 25
npm run report:policy-segment-audit -- "./multi-market-comparisons" --outcomes "./data/outcomes/flashscore" --limit 25
python3 scripts/export_polymarket_tennis.py --markets ./data/polymarket/raw/markets.parquet --out-dir ./data/polymarket/processed
python3 scripts/export_polymarket_tennis_quant.py --quant ./data/polymarket/raw/quant.parquet --market-ids ./data/polymarket/processed/polymarket-tennis-match-winner-market-ids.txt --out ./data/polymarket/processed/polymarket-tennis-match-winner-quant.jsonl
npm run scan:polymarket -- --markets ./data/polymarket/processed/polymarket-tennis-match-winner-markets.jsonl
npm run scan:polymarket -- --markets ./data/polymarket/processed/polymarket-tennis-match-winner-markets.jsonl --trades ./data/polymarket/processed/polymarket-tennis-match-winner-quant.jsonl
npm run aggregate:polymarket -- --markets ./data/polymarket/processed/polymarket-tennis-match-winner-markets.jsonl --trades ./data/polymarket/processed/polymarket-tennis-match-winner-quant.jsonl --out ./data/polymarket/processed/polymarket-tennis-match-winner-price-series.jsonl
npm run report:polymarket-history -- ./data/polymarket/processed/polymarket-tennis-match-winner-price-series.jsonl
npm run report:polymarket-eligibility -- ./data/polymarket/processed/polymarket-tennis-match-winner-price-series.jsonl
```

Recommended live workflow:
- run `baseline:prefetch` for new Flashscore match URLs when official ATP/WTA/ITF baseline may be missing
- run `capture:snapshot` during live windows with the Flashscore URL and a Kalshi or Polymarket URL
- use `compare:markets` when the same match is available on both Kalshi and Polymarket
- use `recapture:markets` for repeated path collection on high-value multi-market matches
- after matches finish, run `resolve:outcomes` to backfill final results
- run `report:calibration -- ./snapshots --outcomes ./data/outcomes/flashscore`
- run `report:pfair-calibration -- ./snapshots --outcomes ./data/outcomes/flashscore`
- run multi-market and execution reports on `./multi-market-comparisons`
- continue collecting across ATP, ATP Challenger, WTA, ITF men, and ITF women because calibration quality depends on resolved sample size by segment

## Current Wrap-Up

The project now has a full layered system:

1. Layer 1
- live Flashscore match state
- stats extraction
- serve resolution
- snapshots
- baseline source resolution

2. Layer 2
- live `pFair`
- prematch baseline policy
- calibration and candidate evaluation

3. Layer 3
- repeated recapture paths
- regime tagging
- path-aware execution gating

4. Layer 4
- Kalshi market mapping
- Polymarket market mapping
- cross-market comparison
- setup taxonomy
- provider and setup outcome studies

5. Layer 5
- execution ranking and shortlist
- final execution synthesis
- regime-conditioned execution policy
- position sizing policy
- resolved execution audit
- portfolio risk budget
- portfolio audit
- policy segment audit

At this point the project is not blocked by missing architecture.
It is mainly in the sample-collection and policy-tuning phase.

When a Kalshi market URL is provided, the app returns:
- raw Flashscore stats
- raw Kalshi display stats
- `resolvedStats` using `kalshi_ui` first and `flashscore` as fallback
- `decisionSnapshot` with match state, prematch baseline, `pFair`, risk, and trade summary
- optional `canonicalMarketState` and `fairVsMarket` comparison when market pricing is available
- `quality` tier and `edgeSignal` for deciding whether a snapshot is actionable or observation-only

Coverage / quality report currently summarizes:
- Flashscore stats coverage
- Kalshi stats coverage
- prematch baseline coverage
- market state coverage
- official vs fallback baseline rate
- complete baseline rate
- serve availability rate
- market `bid / ask / mid / last` coverage
- grouped by `tourType`, baseline source, and match integrity
