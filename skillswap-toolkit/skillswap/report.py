"""CLI: python -m skillswap.report e1 records.json [--thresholds path]"""
import argparse
import json
import sys

from .thresholds import EVALUATORS, load_thresholds


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("experiment", choices=sorted(EVALUATORS))
    ap.add_argument("records")
    ap.add_argument("--thresholds")
    a = ap.parse_args(argv)
    with open(a.records, encoding="utf-8") as f:
        records = json.load(f)
    res = EVALUATORS[a.experiment](records, load_thresholds(a.thresholds))
    print(json.dumps(res.to_dict(), ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
