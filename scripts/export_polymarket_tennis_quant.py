#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path

import pyarrow.dataset as ds
import pyarrow.parquet as pq


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--quant", default="data/polymarket/raw/quant.parquet")
    parser.add_argument("--market-ids", default="data/polymarket/processed/polymarket-tennis-match-winner-market-ids.txt")
    parser.add_argument("--out", default="data/polymarket/processed/polymarket-tennis-match-winner-quant.jsonl")
    parser.add_argument("--market-id-column", default="market_id")
    parser.add_argument("--batch-size", type=int, default=200_000)
    parser.add_argument("--row-group-start", type=int, default=0)
    parser.add_argument("--row-group-end", type=int, default=None)
    parser.add_argument("--append", action="store_true")
    args = parser.parse_args()

    ids = {line.strip() for line in Path(args.market_ids).read_text().splitlines() if line.strip()}
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)

    parquet_file = pq.ParquetFile(args.quant)
    row_group_end = args.row_group_end if args.row_group_end is not None else parquet_file.num_row_groups
    row_group_end = min(row_group_end, parquet_file.num_row_groups)
    row_group_start = max(args.row_group_start, 0)

    if row_group_start >= row_group_end:
        raise ValueError(f"Invalid row group range: {row_group_start}..{row_group_end}")

    written = 0
    scanned = 0
    id_values = list(ids)
    selected_row_groups = list(range(row_group_start, row_group_end))

    mode = "a" if args.append else "w"
    with out.open(mode) as handle:
        for row_group in selected_row_groups:
            table = parquet_file.read_row_group(row_group)
            market_ids = table[args.market_id_column].to_pylist()
            mask = [str(market_id) in ids for market_id in market_ids]
            scanned += len(mask)
            if not any(mask):
                continue

            filtered = table.filter(mask).to_pydict()
            keys = list(filtered.keys())
            row_count = len(filtered[args.market_id_column])
            for index in range(row_count):
                row = {key: filtered[key][index] for key in keys}
                handle.write(json.dumps(row, default=str) + "\n")
                written += 1

    print(
        json.dumps(
            {
                "ok": True,
                "quant": args.quant,
                "marketIds": len(ids),
                "rowGroupStart": row_group_start,
                "rowGroupEnd": row_group_end,
                "rowGroupTotal": parquet_file.num_row_groups,
                "scannedRows": scanned,
                "writtenRows": written,
                "out": str(out),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
