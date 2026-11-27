"""Verify a password-protected Playwright export without persisting passwords.

Usage:
    python verify-protected-export.py <file> <pdf|xlsx> [expected text ...]

Passwords are read from E2E_EXPORT_PASSWORD and E2E_EXPORT_WRONG_PASSWORD.
The helper exits non-zero unless the document is encrypted, opens with the
correct password, and rejects both the wrong password and an empty password.
A JSON summary (including extracted text) is written to stdout for Playwright.
"""

from __future__ import annotations

import io
import json
import os
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree


class VerificationError(RuntimeError):
    pass


def require(condition: bool, message: str) -> None:
    if not condition:
        raise VerificationError(message)


def verify_pdf(path: Path, password: str, wrong_password: str) -> tuple[str, int, int]:
    from pypdf import PdfReader

    def require_pdf_password_rejected(candidate: str, label: str) -> None:
        reader = PdfReader(str(path))
        require(reader.is_encrypted, "PDF is not encrypted")
        try:
            result = reader.decrypt(candidate)
        except Exception:
            # pypdf versions may signal a bad password by raising rather than
            # returning PasswordType.NOT_DECRYPTED. The correct-password open
            # below still fails loudly if the document itself is unreadable.
            return
        require(int(result) == 0, f"PDF opened with {label}")

    require_pdf_password_rejected("", "no password")
    require_pdf_password_rejected(wrong_password, "the wrong password")

    reader = PdfReader(str(path))
    require(reader.is_encrypted, "PDF is not encrypted")
    correct_result = reader.decrypt(password)
    require(int(correct_result) != 0, "PDF rejected the correct password")

    pages = list(reader.pages)
    require(len(pages) > 0, "PDF has no pages")
    text = "\n".join(page.extract_text() or "" for page in pages)
    image_count = sum(len(page.images) for page in pages)
    return text, len(pages), image_count


def worksheet_text(workbook: zipfile.ZipFile) -> str:
    namespace = {"x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    shared_strings: list[str] = []
    if "xl/sharedStrings.xml" in workbook.namelist():
        root = ElementTree.fromstring(workbook.read("xl/sharedStrings.xml"))
        shared_strings = [
            "".join(node.itertext())
            for node in root.findall("x:si", namespace)
        ]

    values: list[str] = []
    for name in sorted(workbook.namelist()):
        if not name.startswith("xl/worksheets/") or not name.endswith(".xml"):
            continue
        root = ElementTree.fromstring(workbook.read(name))
        for cell in root.findall(".//x:c", namespace):
            cell_type = cell.get("t")
            value_node = cell.find("x:v", namespace)
            raw_value = value_node.text if value_node is not None else ""
            if cell_type == "s" and raw_value:
                try:
                    values.append(shared_strings[int(raw_value)])
                except (ValueError, IndexError) as exc:
                    raise VerificationError(f"Invalid shared-string index in {name}") from exc
            elif cell_type == "inlineStr":
                inline = cell.find("x:is", namespace)
                if inline is not None:
                    values.append("".join(inline.itertext()))
            elif raw_value:
                values.append(raw_value)
    return "\n".join(values)


def verify_xlsx(path: Path, password: str, wrong_password: str) -> tuple[str, int, int]:
    import msoffcrypto

    def encrypted_office() -> msoffcrypto.OfficeFile:
        stream = path.open("rb")
        try:
            office = msoffcrypto.OfficeFile(stream)
            require(office.is_encrypted(), "XLSX is not encrypted")
            return office
        except Exception:
            stream.close()
            raise

    for label, candidate in (("no password", ""), ("the wrong password", wrong_password)):
        office = encrypted_office()
        try:
            try:
                office.load_key(password=candidate)
                office.decrypt(io.BytesIO())
            except Exception:
                continue
            raise VerificationError(f"XLSX opened with {label}")
        finally:
            office.file.close()

    office = encrypted_office()
    decrypted = io.BytesIO()
    try:
        try:
            office.load_key(password=password)
            office.decrypt(decrypted)
        except Exception as exc:
            raise VerificationError("XLSX rejected the correct password") from exc
    finally:
        office.file.close()

    decrypted.seek(0)
    with zipfile.ZipFile(decrypted) as workbook:
        require(workbook.testzip() is None, "Decrypted XLSX contains a corrupt ZIP member")
        text = worksheet_text(workbook)
        sheet_count = len([
            name for name in workbook.namelist()
            if name.startswith("xl/worksheets/sheet") and name.endswith(".xml")
        ])
    require(sheet_count > 0, "XLSX has no worksheets")
    return text, sheet_count, 0


def main(argv: list[str]) -> int:
    if len(argv) < 3:
        print(
            "usage: verify-protected-export.py <file> <pdf|xlsx> [expected text ...]",
            file=sys.stderr,
        )
        return 2

    path = Path(argv[1])
    kind = argv[2].lower()
    expected = argv[3:]
    password = os.environ.get("E2E_EXPORT_PASSWORD", "")
    wrong_password = os.environ.get("E2E_EXPORT_WRONG_PASSWORD", "")
    if not password or not wrong_password:
        print("E2E_EXPORT_PASSWORD and E2E_EXPORT_WRONG_PASSWORD are required", file=sys.stderr)
        return 2
    if password == wrong_password:
        print("Correct and wrong test passwords must differ", file=sys.stderr)
        return 2
    if kind not in {"pdf", "xlsx"}:
        print("kind must be pdf or xlsx", file=sys.stderr)
        return 2
    if not path.is_file():
        print(f"Export file not found: {path}", file=sys.stderr)
        return 2

    try:
        if kind == "pdf":
            text, container_count, image_count = verify_pdf(path, password, wrong_password)
            container_label = "pages"
        else:
            text, container_count, image_count = verify_xlsx(path, password, wrong_password)
            container_label = "worksheets"
        missing = [token for token in expected if token not in text]
        require(not missing, f"Decrypted {kind.upper()} is missing expected text: {missing}")
        print(json.dumps({
            "kind": kind,
            "encrypted": True,
            "correctPasswordOpened": True,
            "wrongPasswordRejected": True,
            "noPasswordRejected": True,
            container_label: container_count,
            "imageCount": image_count,
            "text": text,
        }, ensure_ascii=False))
        return 0
    except Exception as exc:  # noqa: BLE001 - report a concise verification failure
        print(f"protected export verification failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
