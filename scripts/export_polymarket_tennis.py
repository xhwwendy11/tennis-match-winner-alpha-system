#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any

import pandas as pd


TENNIS_RE = re.compile(
    r"tennis|\batp\b|\bwta\b|\bitf\b|wimbledon|roland garros|french open|us open|australian open|challenger",
    re.I,
)
HANDICAP_RE = re.compile(r"handicap|spread|\(-?\d+\.?\d*\)|\(\+?\d+\.?\d*\)", re.I)
TOTAL_RE = re.compile(r"total games|total sets|over/under|\bover\b|\bunder\b", re.I)
MATCH_RE = re.compile(r"\bvs\.?\b|\bversus\b|\sbeat\s|\sdefeat\s", re.I)
OUTRIGHT_RE = re.compile(
    r"win (?:the )?(?:20\d{2} )?(?:us open|french open|australian open|wimbledon|atp|wta|tournament|title)|winner",
    re.I,
)


def as_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and pd.isna(value):
        return ""
    return str(value)


def market_kind(row: pd.Series) -> str:
    combined = " ".join(
        as_text(row.get(col))
        for col in ["question", "slug", "event_title", "event_slug"]
    )
    if HANDICAP_RE.search(combined):
        return "handicap"
    if TOTAL_RE.search(combined):
        return "total"
    if MATCH_RE.search(combined):
        return "match_winner"
    if OUTRIGHT_RE.search(combined):
        return "outright"
    return "other"


def clean_player(value: str | None) -> str | None:
    if not value:
        return None
    cleaned = re.sub(r"\?.*$", "", value)
    cleaned = re.sub(r"\bwill\b", "", cleaned, flags=re.I)
    cleaned = re.sub(r"\bwin\b.*$", "", cleaned, flags=re.I)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned or None


def players(row: pd.Series) -> tuple[str | None, str | None]:
    candidates = [as_text(row.get("question")).strip(), as_text(row.get("event_title")).strip()]
    for candidate in [value for value in candidates if value]:
        beat = re.search(r"will\s+(.+?)\s+(?:beat|defeat)\s+(.+?)(?:\?|$)", candidate, re.I)
        if beat:
            return clean_player(beat.group(1)), clean_player(beat.group(2))

        after_colon = ":".join(candidate.split(":")[1:]).strip() if ":" in candidate else candidate
        vs = re.search(r"(.+?)\s+(?:vs\.?|versus)\s+(.+?)(?:\?|$)", after_colon, re.I)
        if vs:
            return clean_player(vs.group(1)), clean_player(vs.group(2))

    return None, None


def parse_outcome_prices(value: Any) -> tuple[float, float] | None:
    if isinstance(value, (list, tuple)) and len(value) >= 2:
        raw = value
    else:
        text = as_text(value).strip()
        if not text:
            return None
        try:
            raw = json.loads(text)
        except Exception:
            try:
                raw = json.loads(text.replace("'", '"'))
            except Exception:
                return None

    try:
        first = float(raw[0])
        second = float(raw[1])
    except Exception:
        return None
    return first, second


def winner(row: pd.Series) -> str:
    if int(row.get("closed") or 0) == 0:
        return "unknown"
    prices = parse_outcome_prices(row.get("outcome_prices"))
    if not prices:
        return "unknown"
    first, second = prices
    if first >= 0.98 and second <= 0.02:
        return "token1"
    if second >= 0.98 and first <= 0.02:
        return "token2"
    return "unknown"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--markets", default="data/polymarket/raw/markets.parquet")
    parser.add_argument("--out-dir", default="data/polymarket/processed")
    parser.add_argument("--keep-all-tennis", action="store_true")
    args = parser.parse_args()

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    df = pd.read_parquet(args.markets)
    text_cols = [col for col in ["question", "slug", "event_title", "event_slug"] if col in df.columns]
    combined = df[text_cols].fillna("").agg(" ".join, axis=1)
    tennis = df[combined.str.contains(TENNIS_RE, regex=True)].copy()

    tennis["marketKind"] = tennis.apply(market_kind, axis=1)
    player_values = tennis.apply(players, axis=1)
    tennis["playerA"] = [value[0] for value in player_values]
    tennis["playerB"] = [value[1] for value in player_values]
    tennis["winner"] = tennis.apply(winner, axis=1)

    match_winner = tennis[
        (tennis["marketKind"] == "match_winner")
        & tennis["playerA"].notna()
        & tennis["playerB"].notna()
    ].copy()

    columns = [
        "id",
        "condition_id",
        "question",
        "slug",
        "event_id",
        "event_slug",
        "event_title",
        "volume",
        "closed",
        "active",
        "archived",
        "outcome_prices",
        "end_date",
        "marketKind",
        "playerA",
        "playerB",
        "winner",
    ]
    columns = [col for col in columns if col in match_winner.columns]

    all_tennis_path = out_dir / "polymarket-tennis-markets.jsonl"
    match_winner_path = out_dir / "polymarket-tennis-match-winner-markets.jsonl"
    ids_path = out_dir / "polymarket-tennis-match-winner-market-ids.txt"

    if args.keep_all_tennis:
        tennis.to_json(all_tennis_path, orient="records", lines=True)

    match_winner[columns].to_json(match_winner_path, orient="records", lines=True)
    match_winner["id"].dropna().astype(str).drop_duplicates().to_csv(ids_path, index=False, header=False)

    print(
        json.dumps(
            {
                "ok": True,
                "totalMarkets": int(len(df)),
                "tennisMarkets": int(len(tennis)),
                "matchWinnerMarkets": int(len(match_winner)),
                "settledMatchWinnerMarkets": int((match_winner["winner"] != "unknown").sum()),
                "matchWinnerPath": str(match_winner_path),
                "matchWinnerIdsPath": str(ids_path),
                "allTennisPath": str(all_tennis_path) if args.keep_all_tennis else None,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
