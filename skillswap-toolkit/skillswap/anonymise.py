"""Create stable anonymised participant IDs from private contact data.

SKILLSWAP_SALT=<long secret> python -m skillswap.anonymise people.csv private_map.csv
Input columns: role (learner|mentor|operator), contact, any others.
Output: the same rows plus participant_id. Keep the output PRIVATE; never commit it.
"""
import csv
import hashlib
import hmac
import os
import sys

PREFIX = {"learner": "L", "mentor": "M", "operator": "O"}


def participant_id(role: str, contact: str, salt: str) -> str:
    if role not in PREFIX:
        raise ValueError(f"bad role {role!r}")
    norm = contact.strip().lower().lstrip("@")
    digest = hmac.new(salt.encode(), norm.encode(), hashlib.sha256).hexdigest()[:10]
    return f"{PREFIX[role]}-{digest}"


def main(argv=None) -> int:
    salt = os.environ.get("SKILLSWAP_SALT", "")
    if len(salt) < 16:
        print("Set SKILLSWAP_SALT to a secret of at least 16 characters", file=sys.stderr)
        return 2
    src, dst = (argv or sys.argv[1:])[:2]
    with open(src, newline="", encoding="utf-8") as f:
        rd = csv.DictReader(f)
        rows = list(rd)
        fields = ["participant_id"] + list(rd.fieldnames)
    for r in rows:
        r["participant_id"] = participant_id(r["role"], r["contact"], salt)
    with open(dst, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)
    print(f"wrote {len(rows)} rows to {dst}. This file contains contact data: keep it private.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
