"""배포 사전 검사를 임시 JAR와 DB 적용 목록으로 시험한다. 실제 DB는 사용하지 않는다."""
import contextlib
import hashlib
import io
import re
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from zipfile import ZipFile

SHELL = Path(__file__).resolve().parents[1] / "deploy-ai-backend.sh"
PROGRAM = re.search(r"python3 - \"\$check_dir\" <<'PY'\n(.*?)\nPY", SHELL.read_text(encoding="utf-8"), re.S).group(1)
PRODUCTION_HASH = "d1dc0381ea93b872ae5e9c90bf964efe420aa20d42ae75f33937cea47682e9df"
FIXTURE_SQL = b"ALTER TABLE test_table ADD COLUMN optional_value INT;\n"
# 시험 JAR의 작은 SQL을 승인한 것으로 가정한다. 운영 스크립트는 수정하지 않는다.
FIXTURE_PROGRAM = PROGRAM.replace(PRODUCTION_HASH, hashlib.sha256(FIXTURE_SQL).hexdigest())


class MigrationPreflightTest(unittest.TestCase):
    def run_guard(self, applied, scripts, failed="0"):
        with tempfile.TemporaryDirectory(dir=Path.cwd()) as directory:
            root = Path(directory)
            (root / "applied.txt").write_text("\n".join(applied))
            (root / "failed.txt").write_text(failed)
            with ZipFile(root / "app.jar", "w") as jar:
                for filename, body in scripts.items():
                    jar.writestr("BOOT-INF/classes/db/migration/" + filename, body)
            with patch.object(sys, "argv", ["guard", str(root)]):
                with contextlib.redirect_stdout(io.StringIO()):
                    exec(compile(FIXTURE_PROGRAM, "migration-preflight", "exec"), {})

    def test_same_versions_pass(self):
        self.run_guard(["51"], {"V51__existing.sql": b"SELECT 1;"})

    def test_reviewed_addition_passes(self):
        self.run_guard(["51"], {"V51__existing.sql": b"SELECT 1;", "V52__reviewed.sql": FIXTURE_SQL})

    def test_changed_reviewed_sql_is_blocked(self):
        with self.assertRaises(SystemExit):
            self.run_guard(["51"], {"V51__existing.sql": b"SELECT 1;", "V52__reviewed.sql": b"DROP TABLE test_table;"})

    def test_unreviewed_new_version_is_blocked(self):
        with self.assertRaises(SystemExit):
            self.run_guard(["51"], {"V51__existing.sql": b"SELECT 1;", "V54__unknown.sql": FIXTURE_SQL})

    def test_older_image_is_blocked(self):
        with self.assertRaises(SystemExit):
            self.run_guard(["51", "52"], {"V51__existing.sql": b"SELECT 1;"})

    def test_failed_migration_is_blocked(self):
        with self.assertRaises(SystemExit):
            self.run_guard(["51"], {"V51__existing.sql": b"SELECT 1;"}, failed="1")

    def test_empty_database_is_blocked(self):
        with self.assertRaises(SystemExit):
            self.run_guard([], {"V52__reviewed.sql": FIXTURE_SQL})

    def test_duplicate_versions_are_blocked(self):
        with self.assertRaises(SystemExit):
            self.run_guard(["51"], {"V51__one.sql": b"SELECT 1;", "V51__two.sql": b"SELECT 2;"})

    def test_repeatable_sql_requires_review(self):
        with self.assertRaises(SystemExit):
            self.run_guard(["51"], {"V51__existing.sql": b"SELECT 1;", "R__unexpected.sql": b"SELECT 2;"})


if __name__ == "__main__":
    unittest.main()
