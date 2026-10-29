import unittest

from lab import collection_name, ensure_index, fuse, metrics, validate


class Collection:
    def __init__(self):
        self.ids = set()

    def get(self, ids, include):
        return {"ids": [eid for eid in ids if eid in self.ids]}

    def upsert(self, ids, **kwargs):
        self.ids.update(ids)


class Tests(unittest.TestCase):
    def test_repeated_index_does_not_encode_existing_blocks(self):
        collection = Collection()
        calls = []

        def encode(texts):
            calls.append(texts)
            return [[1.0, 0.0] for _ in texts]

        blocks = [{"evidenceId": "demo#B1", "sectionPath": "주석", "text": "자료"}]
        self.assertEqual(ensure_index(collection, blocks, encode), 1)
        self.assertEqual(ensure_index(collection, blocks, encode), 0)
        self.assertEqual(len(calls), 1)

    def test_parser_model_revision_and_content_invalidate_cache(self):
        base = collection_name("r", "p1", "m1", "sha1", [{"text": "a"}])
        for args in [("r", "p2", "m1", "sha1", [{"text": "a"}]),
                     ("r", "p1", "m2", "sha1", [{"text": "a"}]),
                     ("r", "p1", "m1", "sha2", [{"text": "a"}]),
                     ("r", "p1", "m1", "sha1", [{"text": "b"}])]:
            self.assertNotEqual(base, collection_name(*args))

    def test_fusion_rewards_agreement(self):
        self.assertEqual(fuse(["a", "b"], ["b", "c"])[0], "b")

    def test_duplicate_rank_does_not_inflate_score(self):
        self.assertEqual(fuse(["a", "a", "b"], ["b"])[0], "b")

    def test_metric_uses_all_relevant_evidence(self):
        recall, mrr = metrics(["wrong", "a"], ["a", "b"])
        self.assertEqual(recall, 0.5)
        self.assertEqual(mrr, 0.5)

    def test_unknown_gold_reference_is_rejected(self):
        data = {"reports": [{"rceptNo": "r", "blocks": [
            {"evidenceId": "r#B1", "text": "원문", "sectionPath": "주석"}]}],
            "queries": [{"rceptNo": "r", "aliases": ["매출"],
                         "expectedEvidenceIds": ["r#B2"]}]}
        with self.assertRaises(ValueError):
            validate(data)

    def test_bm25_baseline_sample_finds_sales_evidence(self):
        import json
        from pathlib import Path
        from baseline.model import Source
        from baseline.search import Index
        data = json.loads(Path("sample.json").read_text(encoding="utf-8"))
        reports = validate(data)
        blocks = reports["demo-only"]["blocks"]
        sources = [Source(b["evidenceId"], b["sectionPath"], b["text"]) for b in blocks]
        self.assertEqual(Index(sources).candidates(["매출액"])[0].evidence_id, "demo-only#B1")


if __name__ == "__main__":
    unittest.main()
