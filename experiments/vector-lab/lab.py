"""분리된 벡터 검색 실험. 서비스·DB·외부 LLM은 수정하거나 호출하지 않는다."""
import hashlib
import json
import os
import time
from pathlib import Path

from baseline.model import Source
from baseline.search import Index


def collection_name(report, parser, model, revision, blocks):
    # 본문까지 포함해 같은 ID의 글이 바뀌었을 때 낡은 임베딩을 재사용하지 않는다.
    identity = [report, parser, model, revision, "truncate1500-seq512-v1", blocks]
    raw = json.dumps(identity, ensure_ascii=False, sort_keys=True).encode()
    return "report-" + hashlib.sha256(raw).hexdigest()[:48]


def fuse(*rankings, limit=5, k=60):
    scores = {}
    for ranking in rankings:
        for rank, evidence in enumerate(dict.fromkeys(ranking), 1):
            scores[evidence] = scores.get(evidence, 0.0) + 1.0 / (k + rank)
    return sorted(scores, key=lambda evidence: (-scores[evidence], evidence))[:limit]


def metrics(ranking, expected):
    relevant = set(expected)
    if not relevant:
        raise ValueError("정답 근거 ID가 비어 있습니다.")
    recall = len(set(ranking[:5]) & relevant) / len(relevant)
    reciprocal = next((1.0 / n for n, eid in enumerate(ranking[:5], 1)
                       if eid in relevant), 0.0)
    return recall, reciprocal


def ensure_index(collection, blocks, encode):
    ids = [b["evidenceId"] for b in blocks]
    present = set(collection.get(ids=ids, include=[])["ids"])
    missing = [b for b in blocks if b["evidenceId"] not in present]
    for offset in range(0, len(missing), 16):
        batch = missing[offset:offset + 16]
        vectors = encode([b["text"][:1500] for b in batch])
        collection.upsert(ids=[b["evidenceId"] for b in batch], embeddings=vectors,
                          documents=[b["text"][:1500] for b in batch],
                          metadatas=[{"sectionPath": b["sectionPath"]} for b in batch])
    return len(missing)


def validate(data):
    if not data.get("reports") or not data.get("queries"):
        raise ValueError("reports와 queries가 필요합니다.")
    reports = {}
    for report in data["reports"]:
        if report["rceptNo"] in reports or not report["blocks"]:
            raise ValueError("접수번호 중복 또는 빈 보고서입니다.")
        ids = [b["evidenceId"] for b in report["blocks"]]
        if len(ids) != len(set(ids)):
            raise ValueError("근거 ID 중복입니다.")
        if any(not eid.startswith(report["rceptNo"] + "#B") for eid in ids):
            raise ValueError("근거 ID의 접수번호가 보고서와 다릅니다.")
        if any(not b["text"].strip() for b in report["blocks"]):
            raise ValueError("빈 원문 블록입니다.")
        reports[report["rceptNo"]] = report
    for query in data["queries"]:
        report = reports[query["rceptNo"]]
        ids = {b["evidenceId"] for b in report["blocks"]}
        if not query["aliases"] or not query["expectedEvidenceIds"]:
            raise ValueError("검색어 또는 정답이 비었습니다.")
        if not set(query["expectedEvidenceIds"]) <= ids:
            raise ValueError("정답 근거가 보고서에 없습니다.")
    return reports


def run():
    import resource
    import chromadb
    from chromadb.config import Settings
    from huggingface_hub import HfApi
    from sentence_transformers import SentenceTransformer

    input_path = Path(os.getenv("DATASET", "/lab/sample.json"))
    data = json.loads(input_path.read_text(encoding="utf-8"))
    reports = validate(data)
    model_id = os.getenv("EMBEDDING_MODEL", "nlpai-lab/KURE-v1")
    revision = HfApi().model_info(model_id, revision=os.getenv("EMBEDDING_REVISION", "main")).sha
    if not revision:
        raise ValueError("임베딩 모델의 리비전을 확인할 수 없습니다.")
    started = time.perf_counter()
    model = SentenceTransformer(model_id, revision=revision, device="cpu", trust_remote_code=False)
    model.max_seq_length = 512
    load_seconds = time.perf_counter() - started

    def encode(texts):
        return model.encode(texts, batch_size=2, normalize_embeddings=True,
                            show_progress_bar=False).tolist()

    client = chromadb.PersistentClient(path="/data/chroma", settings=Settings(anonymized_telemetry=False))
    indexes, indexed = {}, []
    for rcept, report in reports.items():
        name = collection_name(rcept, report["parserVersion"], model_id, revision, report["blocks"])
        collection = client.get_or_create_collection(name, embedding_function=None,
                                                     metadata={"hnsw:space": "cosine"})
        begin = time.perf_counter()
        created = ensure_index(collection, report["blocks"], encode)
        indexes[rcept] = collection
        indexed.append({"rceptNo": rcept, "newEmbeddings": created,
                        "indexSeconds": time.perf_counter() - begin, "collection": name})

    rows = []
    for query in data["queries"]:
        report = reports[query["rceptNo"]]
        sources = [Source(b["evidenceId"], b["sectionPath"], b["text"]) for b in report["blocks"]]
        begin = time.perf_counter()
        bm25 = [s.evidence_id for s in Index(sources).candidates(query["aliases"])]
        vectors = encode([" ".join(query["aliases"])])
        result = indexes[query["rceptNo"]].query(query_embeddings=vectors,
                  n_results=min(20, len(sources)), include=["distances"])
        vector = result["ids"][0]
        hybrid = fuse(bm25, vector)
        row = {"queryId": query["id"], "bm25Ids": bm25, "hybridIds": hybrid,
               "searchSeconds": time.perf_counter() - begin}
        for method, ranking in (("bm25", bm25), ("hybrid", hybrid)):
            recall, mrr = metrics(ranking, query["expectedEvidenceIds"])
            row[method + "RecallAt5"] = recall
            row[method + "MrrAt5"] = mrr
        rows.append(row)

    count = len(rows)
    baseline = sum(r["bm25RecallAt5"] for r in rows) / count
    hybrid = sum(r["hybridRecallAt5"] for r in rows) / count
    gold = data.get("humanReviewed") is True and count == 25
    output = {"datasetSha256": hashlib.sha256(input_path.read_bytes()).hexdigest(),
              "humanReviewed25Queries": gold, "model": model_id, "revision": revision,
              "modelLoadSeconds": load_seconds, "indexing": indexed,
              "peakProcessMemoryMiB": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024,
              "bm25RecallAt5": baseline, "hybridRecallAt5": hybrid,
              "deltaPercentagePoints": (hybrid - baseline) * 100,
              "adoptionStatus": "MEETS_SINGLE_MODEL_GATE_EXPERIMENT_ONLY" if gold and hybrid - baseline >= 0.10 - 1e-9
                                else "NOT_ELIGIBLE_OR_BELOW_GATE",
              "rows": rows}
    Path("/results").mkdir(exist_ok=True)
    stamp = time.strftime("%Y%m%d-%H%M%S")
    target = Path("/results") / f"result-{stamp}.json"
    target.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"result": str(target), "indexing": indexed,
                      "deltaPercentagePoints": output["deltaPercentagePoints"],
                      "adoptionStatus": output["adoptionStatus"]}, ensure_ascii=False))


if __name__ == "__main__":
    run()
