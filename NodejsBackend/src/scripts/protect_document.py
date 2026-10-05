"""Encrypt one exported document with a downloader-supplied password.

Usage: protect_document.py <in_path> <out_path> <kind>
  kind: "pdf" | "xlsx"
  password: read from the GHE_DOC_PASSWORD environment variable (never argv,
  so it does not appear in process listings).

Exit codes: 0 ok, 2 usage error, 3 missing password, 4 unsupported kind,
5 encryption failure. Nothing is printed on success; errors go to stderr.
"""

import os
import sys


def fail(code: int, message: str) -> "NoReturn":
    print(f"protect_document: {message}", file=sys.stderr)
    sys.exit(code)


def main() -> None:
    if len(sys.argv) != 4:
        fail(2, "usage: protect_document.py <in_path> <out_path> <pdf|xlsx>")
    in_path, out_path, kind = sys.argv[1], sys.argv[2], sys.argv[3]
    password = os.environ.get("GHE_DOC_PASSWORD", "")
    if not password:
        fail(3, "GHE_DOC_PASSWORD is not set")
    try:
        if kind == "pdf":
            from pypdf import PdfReader, PdfWriter

            reader = PdfReader(in_path)
            if reader.is_encrypted:
                fail(5, "input PDF is already encrypted")
            writer = PdfWriter()
            writer.append(reader)
            # AES-256; owner password equals user password so the password
            # unlocks full access (no separate owner channel to manage).
            writer.encrypt(
                user_password=password, owner_password=password, use_128bit=False
            )
            with open(out_path, "wb") as out:
                writer.write(out)
        elif kind == "xlsx":
            import msoffcrypto

            with open(in_path, "rb") as fin:
                office = msoffcrypto.OfficeFile(fin)
                if office.is_encrypted():
                    fail(5, "input workbook is already encrypted")
                with open(out_path, "wb") as fout:
                    office.encrypt(password, fout)
        else:
            fail(4, f"unsupported kind: {kind}")
    except SystemExit:
        raise
    except Exception as exc:  # noqa: BLE001 - surfaced as exit 5
        fail(5, f"encryption failed: {exc}")


if __name__ == "__main__":
    from typing import NoReturn

    main()
