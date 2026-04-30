## Tennis Match Winner Alpha System

这是一个基于网球 live 比赛状态的实时定价与交易决策系统。

项目按 5 层结构组织：
1. Layer 1：标准化 live 比赛状态
2. Layer 2：`pFair` 概率与风险引擎
3. Layer 3：连续状态 / 隐状态 / regime 跟踪
4. Layer 4：市场映射、错价识别与多市场比较
5. Layer 5：执行、仓位与组合合成

这个项目已经不只是 live 比分抓取器，也不只是一个胜负概率模型。
它现在已经支持一条完整链路：
- Flashscore live state
- 官方 / 历史赛前 baseline
- `pFair`
- `fair vs Kalshi`
- `fair vs Polymarket`
- `Kalshi vs Polymarket`
- setup 分类
- execution ranking 与 shortlist
- 带 regime 约束的 execution policy
- 仓位 sizing
- resolved execution audit
- portfolio risk budget
- portfolio audit
- policy segment audit

## 当前范围

项目当前已经包含：
- Flashscore 网球 live 抽取
- `dom / retry / unknown` 的发球方识别
- best-of-3 live tennis 的 `pointRisk` 规则引擎
- 异常状态 hard-stop 保护
- 官方与 Flashscore-history 赛前 baseline 来源
- 从 point 到 game、set、match 的 `pFair`
- 用于 replay 与 calibration 的 decision snapshots
- Kalshi 的 fair-vs-market 比较与 edge signal
- Polymarket live market adapter
- Kalshi 与 Polymarket 的单场比较
- repeated recapture path report
- provider-aware market eligibility
- `liveDecision` 与 setup taxonomy
- execution dataset / labels / study / ranking / shortlist
- 带 regime policy 和 sizing policy 的 execution synthesis
- resolved execution audit
- portfolio risk budget 与 portfolio audit
- policy segment audit
- 用于赛后 calibration 的 outcome sidecars

## 各 Layer 状态

### Layer 1
已完成：
- Flashscore live 比赛状态
- 发球方识别
- stats 抽取
- decision snapshots
- 从 ATP / WTA / ITF / Flashscore history 接入赛前 baseline

仍未完全完成：
- 更密的自动 live 采样
- 更强的延迟 / stale-source 监控

### Layer 2
已完成：
- 从 point -> game -> set -> match 的 `pFair`
- 官方与 fallback baseline policy
- calibration report 与 candidate report

仍未完全完成：
- 按 segment 划分的更大 resolved sample
- 按赛事 / quality bucket 的更多参数调优

### Layer 3
已完成：
- repeated recapture paths
- final execution synthesis 中的 regime tagging
- path-aware execution gating

仍未完全完成：
- 更丰富的 hidden-state / alpha-pattern 建模
- 超出当前 path summary 的更强连续状态特征

### Layer 4
已完成：
- `fair vs Kalshi`
- `fair vs Polymarket`
- `Kalshi vs Polymarket`
- provider deviation report
- resolved cross-market study
- setup taxonomy 与 setup-outcome study

仍未完全完成：
- 更大的 resolved multi-market sample
- 更强的 provider-specific 历史结论

### Layer 5
已完成：
- execution dataset
- 基于 future recapture path 的 fill / adverse label 框架
- execution ranking
- execution shortlist
- execution synthesis
- regime-conditioned execution policy
- position sizing policy
- resolved execution audit
- portfolio risk budget
- portfolio audit
- policy segment audit

仍未完全完成：
- 用于 policy tuning 的更多样本
- 更密的 fill-quality 证据
- 更接近 production 的 execution / queue / book 建模

## 目录结构

- `src/foundation`
  共享状态对象与未来系统基础原语
- `src/kalshi`
  Kalshi 市场数据类型与未来 API client
- `src/realtime-score/tennis`
  Flashscore 网球抓取、解析与发球方识别
- `src/rules/tennis`
  当前规则引擎与 trade plan 逻辑
- `src/app`
  应用编排层
- `src/cli`
  命令行入口

## 初始构建方向

第一个系统级重点是稳定并扩展：
- `src/foundation/canonicalMatchState.ts`
- `src/foundation/canonicalMarketState.ts`
- `src/foundation/prematchBaseline.ts`
- `src/foundation/prematchBaselineBuilder.ts`
- `src/foundation/playerMapping.ts`
- `src/foundation/prematchBaselineProvider.ts`
- `src/probability/probabilityState.ts`

这些对象应该成为以下模块的共同语言：
- match-state ingestion
- risk logic
- future fair-probability logic
- alpha-pattern detection
- execution policy

概率与风险输出层当前已经初始化为结构化输出层：
- baseline schema 已定义
- `prematchBaseline` 可以注入 app entrypoint
- `prematchBaseline` 也可以由 player mapping + ATP/WTA/ITF clients 自动构建
- `probabilityState` 会由 app 返回
- `pFair` 现在已经暴露完整的 `point -> game -> set -> match` fair-probability 结构
- `decisionSnapshot` 由 app 返回，用于 replay、calibration 与 source-level debugging
- 当有 Kalshi market state 时，`decisionSnapshot` 还会携带 `fairVsMarket`
- 当前 `pointRisk` 仍被保留，并通过结构化 probability-state risk/context 字段暴露

当前 source 拆分如下：
- Flashscore -> `canonicalMatchState`
- Kalshi -> `canonicalMarketState`
- ATP Tour JSON endpoints -> ATP prematch baseline source
- WTA official API -> WTA prematch baseline source
- ITF official endpoints -> ITF prematch baseline source

第一批 ATP baseline 文件：
- `src/atp/client.ts`
- `src/atp/types.ts`

第一批 WTA baseline 文件：
- `src/wta/client.ts`
- `src/wta/types.ts`

第一批 ITF baseline 文件：
- `src/itf/client.ts`
- `src/itf/types.ts`

已确认的 ATP player JSON endpoints：
- `/en/-/www/players/hero/{playerId}?v=1`
- `/en/-/www/stats/{playerId}/all/all?v=1`

已确认的 WTA player JSON endpoint：
- `https://api.wtatennis.com/tennis/players/{playerId}/year/{year}`

已确认的 ITF player JSON endpoints：
- `/tennis/api/PlayerApi/GetPlayerOverview?playerId={playerId}&circuitCode={code}&matchTypeCode={code}`
- `/tennis/api/PlayerApi/GetPlayerWinLoss?playerId={playerId}&circuitCode={code}&matchTypeCode={code}&year={year}`

`canonicalMatchState` 当前携带 Layer 1 的核心 bucket：
- source metadata
- competition 和 participant metadata
- scoreboard state
- serve state
- quality / integrity state
- live-stats placeholders
- ingestion timestamps

第一批 Kalshi market layer 文件：
- `src/kalshi/client.ts`
- `src/kalshi/marketClient.ts`
- `src/kalshi/types.ts`

第一批 Polymarket historical-data adapter 文件：
- `src/polymarket/types.ts`
- `src/polymarket/historicalData.ts`
- `src/polymarket/priceSeries.ts`

Polymarket historical-data policy：
- Polymarket 在本项目中被视为 Layer 4/5 的历史市场数据源，而不是 Kalshi live capture 的替代品
- 像 Hugging Face `SII-WANGZJ/Polymarket_data` 这样的公开数据集可以提供市场 metadata、settled outcomes 与 trade/YES-price history
- 项目预期使用从 `markets.parquet` 与 `quant.parquet` / `trades.parquet` 导出的本地行数据
- `markets.parquet` 适合用于筛选 tennis markets 与读取最终 outcome 价格
- `quant.parquet` 适合用于归一化 YES-price time series
- 公开 Polymarket 数据集通常很大，因此不把全量下载放进 live workflow
- tennis market matching 目前仍是基于 question/event text 的 best-effort 方案，用于 production backtest 前必须额外验证
- 从 Hugging Face parquet 文件导出本地 JSON / JSONL / CSV slice 后，用 `scan:polymarket`
- 用 `aggregate:polymarket` 把导出的 trade rows 转成每场 tennis match-winner market 一行的 compact price summary
- `data/polymarket/processed/polymarket-tennis-match-winner-markets.jsonl` 作为有用的 compact metadata slice 保留
- `data/polymarket/processed/polymarket-tennis-match-winner-market-ids.txt` 保留，用于过滤大型价格 / trade parquet 文件
- 当需要完整 historical trade rows 时，保留 `data/polymarket/processed/polymarket-tennis-match-winner-quant.jsonl`
- `data/polymarket/processed/polymarket-tennis-match-winner-price-series.jsonl` 作为 Layer 4/5 的 compact market-history summary 保留
- `data/polymarket/raw/markets.parquet` 在 compact metadata slice 重新生成并验证后可以删除
- `data/polymarket/raw/quant.parquet` 在 compact trade slice 与 price-series summary 重新生成并验证后可以删除
- `data/polymarket/markets-tennis.jsonl` 是中间 broad tennis slice，在 match-winner slice 验证完成后可以删除
- 当前导出的 `quant.parquet` rows 不包含 outcome-token id，所以聚合后的 trade price 被标成 `reported_trade_price_not_player_mapped`；在额外完成 token-side mapping 前，不应把它直接视为 player A / player B 概率

Stats source policy：
- 用于展示的 tennis stats 优先使用 `kalshi_ui`
- 缺失的展示字段回退到 `flashscore`
- 像 `break points` 这类存在争议的字段，即使来自 Kalshi，仍保持较低置信度

Prematch baseline source policy：
- ATP / ATP Challenger -> 优先使用 ATP source
- WTA / WTA Challenger -> 优先使用 WTA source
- ITF -> 优先使用 ITF source
- 如果 official baseline 缺失，则在可用时使用缓存的 Flashscore history
- 如果官方和 Flashscore-history baseline 都不可用，则回退到 market implied probabilities 或 live-state-driven logic

Player identity resolution policy：
- 本地 `playerDirectory` 仍是主要 identity cache
- ATP 现在支持通过 official singles rankings JSON 进行 first-pass automatic discovery
- WTA 现在支持通过 official players page 进行 first-pass automatic discovery
- ITF 现在支持通过 player-profile links 的 best-effort official discovery pass
- 发现到的 ATP mapping 可以回写到本地目录缓存
- ATP / WTA / ITF 现在都是 resolver boundary 里的 first-class discovery slot
- ATP 与 WTA 现在已经有具体的 automatic discovery 实现
- ITF discovery 仍是 best-effort；如果官方 players page 被 anti-bot 阻挡，可能返回空结果

Baseline freshness policy：
- `playerDirectory` 只存 identity
- player baseline data 是时效性数据，应该单独缓存
- ATP / WTA / ITF baseline fetch 现在支持专门的 `baselineCache`
- `sourceId` 应长期复用；baseline stats 应刷新或短期缓存
- Flashscore historical baseline 明确只用于 prefetch 场景
- `capture:snapshot` 只读取 Flashscore-history cache，因此 live capture 不会因为慢速抓 player history 而变慢

Snapshot quality policy：
- `high`：official baseline、live server side、pFair 与 live stats 都可用
- `medium`：Flashscore-history baseline + live server/stats，或 official baseline + score-only state
- `low`：fallback baseline，或虽不完整但仍可观察的输入
- `unusable`：final/non-live、live 状态下缺失 server side、缺失 pFair，或 unsupported doubles

Edge signal policy：
- `fairVsMarket` 把 pFair 与 Kalshi market probabilities 做比较
- `edgeSignal` 使用相对于 Kalshi `last` 的最强 absolute edge
- low-quality snapshots 一律是 `watch_only`
- unusable snapshots 一律是 `ignore`
- 只有 medium/high quality 且 edge 达到 medium/strong 才会升成 `candidate`

Outcome / calibration policy：
- live snapshots 作为 point-in-time evidence 存储
- final match result 单独以 `resolved-match-outcome/v1` sidecar 存储
- calibration 通过 Flashscore match id 或 match URL 把 snapshots 与 outcome sidecars 关联起来
- 这样可以在保留 live capture 不可变的前提下继续做赛后 calibration

P-fair calibration policy：
- 原始 `pFair` 保持为模型未修改的概率输出
- `pFairCalibration` 从 resolved snapshots 中学习保守的 bucket-level bias adjustment
- 通过 `priorStrength` 按样本量对 adjustment 做 shrink
- adjustment 受 `maxAdjustment` 限制
- calibrated pFair 当前只用于 report/output 层；不会覆盖已存储 snapshot
- 当前 calibration 结果只是 in-sample 诊断，不是可交易 alpha 的证明

Execution / `p_fill` policy：
- `pFair` 回答的是“此刻公允胜率是多少？”
- `p_fill` 回答的是“如果我现在在这里挂单，订单被成交的概率有多大？”
- `p_fill` 还没有实现成 production model；它目前是 Layer 5 的 execution 概念
- 当前设想中的第一版定义是：
  - 给定 `side`、`price` 与当前 market state
  - 估计在短未来窗口内该订单可成交的概率
- 更实用的执行定义是：
  - `p_fill_before_move`
  - 订单在市场朝不利方向移动前先成交的概率
- 更简单的 bootstrap 定义是：
  - `p_fill_snapshot_window`
  - 后续 snapshot 是否触及或穿过挂单价格的概率
- `p_fill` 应与 `pFair` 分开建模
- `p_fill` 需要 repeated market snapshots，理想情况下还需要 order-book 或 trade-print 风格历史
- 当前项目已经具备未来 `p_fill` 模型的前置条件：
  - repeated Kalshi market snapshots
  - fair-vs-market comparisons
  - point-in-time match state 与 risk phase
  - compact historical Polymarket market-path summaries
- `p_fill` 最终应综合：
  - side
  - quoted price
  - bid / ask / spread / last
  - phase（`non_tiebreak`、`tiebreak`、break-point pressure 等）
  - recent price movement
  - quality tier
  - time 或 point horizon

`p_fill` v1 design：
- 目标：
  - 估计一个 hypothetical passive order 在 snapshot 之后不久是否可成交
- 预测单位：
  - 一个 snapshot + 一个报价方向 + 一个报价价格 + 一个短 horizon
- 建议的第一阶段 target：
  - `p_fill_snapshot_window`
  - 在 horizon 到期前，后续 market snapshot 是否触及或穿过该价格
- 建议的后续 target：
  - `p_fill_before_move`
  - 订单是否在市场朝不利方向移动前成交
- v1 输入：
  - `fairProbA` / `fairProbB`
  - 相对于 `last` 的 edge
  - 相对于 `ask` 的 edge
  - 相对于 `bid` 的 edge
  - 当前 `bid / ask / spread / last`
  - market side convention（`teamA` / `teamB`）
  - match phase
  - risk rule
  - quality tier
  - tour type
  - server side
  - score state（`setIndex`、games、points、tiebreak flag）
  - 若可知则加上到下一次 snapshot 的 elapsed time
- v1 label 构造：
  - 先设定一个 order hypothesis，例如：
    - 在当前 `bid` 买 A
    - 在 `bid + 0.01` 买 A
    - 在当前 `ask` 卖 A
  - 扫描短窗口内的后续 snapshots
  - 若市场价格触及或改善穿过报价层级，则记为 fillable
  - 若窗口先结束，则记为 not fillable
- v1 限制：
  - snapshot-touch 不等于真实 queue fill
  - 没有 queue position
  - 没有 order-book depth
  - 当前还没有 Kalshi 的精确 trade prints
  - 还不能完全区分有利成交与 adverse-selection 成交
- v1 实际用途：
  - 同时按 `edge` 和近似 `p_fill` 给机会排序
  - 压制那些 edge 很大但大概率成交不了的信号
  - 区分“想法对但成交不了”和“想法本身就不对”
- 建议 horizon：
  - next snapshot
  - 30 seconds
  - 60 seconds
  - 下一个 point / state change 之前
- 建议输出字段：
  - `pFillBidA`
  - `pFillAskA`
  - `pFillBidB`
  - `pFillAskB`
  - `expectedEdgeIfFilled`
  - `fillRiskTag`
- v2 升级路径：
  - 更密的 Kalshi sampling
  - 如果能拿到 trade print 或 book data，则接入
  - 把 adverse selection 与原始 fill probability 分开建模
  - 让 fill 受 market regime 条件化，例如 tiebreak 或 break-point pressure

Player directory format：
- 以 `player-directory.example.json` 作为起始模板
- `player-directory.live-samples.json` 只用于临时 live-match mapping
- `source`
  - `atp`
  - `wta`
  - `itf`
- `sourcePlayerId`
  - 官方 source 的 player id
- `flashscorePlayerId`
  - 可选的 Flashscore player id，用于更可靠的映射
- `flashscoreSlug`
  - 可选的 Flashscore slug fallback
- `fullName`
  - 官方球员名
- `aliases`
  - 可选的别名 / 短名
- `meta`
  - 可选的 source-specific 额外字段
  - 对 ITF，使用：
    - `circuitCode`
    - `matchTypeCode`

## 运行方式

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

推荐 live workflow：
- 对新的 Flashscore match URL，在官方 ATP/WTA/ITF baseline 可能缺失时先跑 `baseline:prefetch`
- 在 live 窗口内，使用 Flashscore URL 搭配 Kalshi 或 Polymarket URL 跑 `capture:snapshot`
- 当同一场比赛同时存在于 Kalshi 和 Polymarket 时，用 `compare:markets`
- 对高价值 multi-market 比赛，用 `recapture:markets` 收集 repeated path
- 比赛结束后，跑 `resolve:outcomes` 回填 final result
- 跑 `report:calibration -- ./snapshots --outcomes ./data/outcomes/flashscore`
- 跑 `report:pfair-calibration -- ./snapshots --outcomes ./data/outcomes/flashscore`
- 在 `./multi-market-comparisons` 上跑 multi-market 与 execution reports
- 持续覆盖 ATP、ATP Challenger、WTA、ITF men、ITF women，因为 calibration 质量取决于各 segment 的 resolved sample size

## 当前总结

项目现在已经拥有完整的分层系统：

1. Layer 1
- live Flashscore match state
- stats extraction
- serve resolution
- snapshots
- baseline source resolution

2. Layer 2
- live `pFair`
- prematch baseline policy
- calibration 与 candidate evaluation

3. Layer 3
- repeated recapture paths
- regime tagging
- path-aware execution gating

4. Layer 4
- Kalshi market mapping
- Polymarket market mapping
- cross-market comparison
- setup taxonomy
- provider 与 setup outcome studies

5. Layer 5
- execution ranking 与 shortlist
- final execution synthesis
- regime-conditioned execution policy
- position sizing policy
- resolved execution audit
- portfolio risk budget
- portfolio audit
- policy segment audit

到这个阶段，项目已经不是被架构缺失卡住。
当前主要处于样本收集与 policy tuning 阶段。

当提供 Kalshi market URL 时，app 会返回：
- 原始 Flashscore stats
- 原始 Kalshi display stats
- 先用 `kalshi_ui`、缺失时回退到 `flashscore` 的 `resolvedStats`
- 包含 match state、prematch baseline、`pFair`、risk 与 trade summary 的 `decisionSnapshot`
- 当 market pricing 可用时，还会返回可选的 `canonicalMarketState` 与 `fairVsMarket`
- 用于判断 snapshot 是可执行还是仅观察的 `quality` tier 与 `edgeSignal`

Coverage / quality report 当前会汇总：
- Flashscore stats coverage
- Kalshi stats coverage
- prematch baseline coverage
- market state coverage
- official vs fallback baseline rate
- complete baseline rate
- serve availability rate
- market `bid / ask / mid / last` coverage
- 并按 `tourType`、baseline source 与 match integrity 分组
