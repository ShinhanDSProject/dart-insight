# DART 벡터 검색 분리 실험

기존 서비스에 접속하거나 변경하지 않는 CPU 전용 실험 도구다. Docker 포트를 공개하지 않는다.
KURE-v1 문장 임베딩을 Chroma 파일 DB에 보관하고 기존 BM25와 RRF 순위 결합을 비교한다.
외부 LLM·OpenDART 호출과 API 키가 필요하지 않다. 모델·패키지 다운로드를 위한 인터넷은 필요하다.

## 확인한 팀 요구사항

- #147: https://github.com/ShinhanDSProject/dart-insight/issues/147
- 채택 기준 댓글: https://github.com/ShinhanDSProject/dart-insight/issues/147#issuecomment-6435187812
- #148: https://github.com/ShinhanDSProject/dart-insight/issues/148
- #148은 보류이며 #147의 채택 결정이 선행 조건이다.
- 사람이 검토한 정답 25질의에서 BM25 대비 recall@5가 10%p 이상 개선돼야 채택 검토 대상이다.
- 현재 도구는 KURE-v1 한 모델의 비교 실험이다. #147이 요구하는 7방식 전체 비교가 아니다.
- sample.json은 직접 작성한 합성 자료다. 실제 공시나 사람이 검토한 평가 자료가 아니다.
- 이 도구 실행 결과만으로 #147·#148을 완료 처리하거나 서비스에 적용하면 안 된다.

## VM2 실행

압축을 VM2의 별도 폴더 ~/vector-lab 에 풀고 그 폴더에서 실행한다.
기존 ~/projects/dart-insight 폴더에 덮어쓰지 않는다.

Git 브랜치에서 실행할 때는 별도 clone 또는 별도 체크아웃의 `experiments/vector-lab` 폴더로 이동한다.
기존 서비스 배포 체크아웃의 브랜치를 실험 실행을 위해 변경하지 않는다.

```bash
mkdir -p results datasets
docker compose config --quiet
sudo docker compose build lab
sudo docker compose run --rm --no-deps lab python -m unittest -v test_lab
sudo docker compose run --rm --no-deps lab
```

처음 실행에는 CPU PyTorch와 KURE 모델을 내려받으므로 시간이 걸린다. 이미지 빌드와 모델 로딩,
임베딩 생성 시간을 구분한다. Chroma는 이 실험 컨테이너 내부 라이브러리로 동작한다.
컨테이너는 메모리 최대 6GB, CPU 최대 2개를 사용한다. VM2 전체 가용 메모리는 별도로 확인한다.
기존 FastAPI에 메모리가 부족해질 수 있으면 이 실험을 실행하지 않고 자원을 먼저 조정한다.

기술 구조: 보고서 문단 → KURE 임베딩 → Chroma 저장 → 벡터 검색 → BM25와 RRF 결합.
RRF는 서로 다른 검색 점수 대신 순위를 결합하는 방법이다.
BM25 코드는 배포 커밋 9624026의 search.py와 model.py를 복사했으며 import 경로만 수정했다.
BM25 상위 5개와 벡터 상위 20개를 합쳐 5개를 반환한다. 공식 비교 시 후보 예산의 공정성도 검토한다.
벡터 입력은 원문 앞 1500자, 모델 최대 길이는 512토큰이다. 긴 문단 뒤의 근거가 누락될 수 있다.
토큰은 모델이 입력을 나누는 단위이며 글자 수와 같지 않다.

## 저장·재사용 확인

첫 실행 종료 후 같은 명령을 다시 실행한다.

```bash
sudo docker compose run --rm --no-deps lab
```

두 번째 결과의 모든 newEmbeddings가 0이어야 문서 임베딩 재사용이 확인된다.
검색어 임베딩은 검색마다 생성한다. 첫 실행은 새 문서 수만큼 newEmbeddings가 나온다.
파서 버전·모델 ID·모델의 실제 리비전·본문·전처리 버전 중 하나라도 바뀌면 다른 컬렉션을 사용한다.
모델 캐시와 Chroma는 별도 Docker 볼륨에 남는다. docker compose down -v는 볼륨을 삭제하므로 사용하지 않는다.
모델 리비전은 최초 결과의 revision 값을 기록한 다음 .env에 EMBEDDING_REVISION=그값 으로 고정한다.
의존성 목록은 이미지의 /lab-dependencies.txt에 저장되며 아래 명령으로 별도 보관할 수 있다.

```bash
sudo docker compose run --rm --no-deps lab cat /lab-dependencies.txt > results/dependencies.txt
```

## 실제 정답 자료

sample.json 구조로 datasets/gold.json을 작성한다. reports에는 PARAGRAPH 블록만 넣는다.
접수번호·파서 버전·근거 ID·섹션 경로·본문은 실제 데이터와 일치해야 한다.
expectedEvidenceIds는 모델이 아니라 사람이 원문을 보고 정한 정답 근거 ID 목록이다.
검토 완료한 25질의일 때만 humanReviewed를 true로 설정한다.

```bash
sudo docker compose run --rm --no-deps -e DATASET=/datasets/gold.json lab
```

또는 .env에 DATASET=/datasets/gold.json 을 적고 기본 실행 명령을 쓴다.
결과는 results/result-시간.json에 저장된다. 원문은 출력하지 않고 후보 ID·지표를 기록한다.
recall@5는 정답 근거 중 상위 5개에서 찾은 비율, MRR@5는 첫 정답 순위의 역수다.
여러 정답 근거가 있으면 질의 하나가 반드시 4%p씩 움직이는 것은 아니므로 정답 단위 합의가 필요하다.
peakProcessMemoryMiB는 Python 프로세스 최고 사용 메모리이며 컨테이너 전체 메모리가 아니다.
searchSeconds는 BM25·검색어 임베딩·벡터검색·순위 결합을 합한 시간이다.

## 구현 범위와 남은 일

준비됨: 로컬 모델 임베딩, Chroma 영구 저장, 본문 캐시 키, BM25/RRF 비교, 지표·리비전 기록, 합성 예제.
로컬 검증됨: 캐시 재사용·버전 무효화·RRF·지표·정답 검증·BM25 예제의 단위 테스트 7개.
미검증: 실제 Docker 빌드, KURE 다운로드·추론, 실제 Chroma 저장 및 컨테이너 종료 후 재사용.
미완료: 사람이 검토한 정답 25개, 7방식 전체 비교, 팀 채택 결정, 실제 서비스 호출 경로 반영,
Chroma 장애 시 서비스의 BM25 대체 처리, 분석 버전 갱신과 API·ADR 변경.
서비스 반영 단계에서 기존 분석의 결과 검증·근거 ID 제약을 그대로 유지해야 한다.

## 인프라와 AI 역할 구분

이 도구의 목적은 AI 검색 방식 평가이고, Docker와 저장 볼륨이 그 실험 실행 환경을 제공한다.

| 구성 | 분류 | 역할 |
| --- | --- | --- |
| Dockerfile | 인프라·실행 환경 | Python, CPU PyTorch, Chroma와 임베딩 라이브러리를 이미지에 설치 |
| compose.yaml | 인프라·실행 환경 | 메모리·CPU 제한, 저장 볼륨과 실행 설정 관리 |
| vector_data 볼륨 | 인프라·데이터 보존 | 컨테이너가 종료돼도 Chroma 파일 유지 |
| model_cache 볼륨 | 인프라·캐시 | 모델 다운로드 파일 보존 |
| KURE 인코딩 | AI·검색 | 문단과 검색어를 의미 벡터로 변환. 모델 학습은 하지 않음 |
| Chroma 저장·질의 | AI 데이터 계층 | 문서 벡터 보관과 가까운 벡터 검색 |
| baseline/search.py | 검색 알고리즘 | 배포 버전 9624026의 BM25 기준선 |
| lab.py의 fuse | 검색 알고리즘 | BM25 순위와 벡터 순위를 RRF로 결합 |
| metrics와 test_lab.py | 평가·품질 검증 | 정답 근거와 검색 결과 비교 및 코드 동작 검사 |

`python lab.py`는 계속 떠 있는 API 서버가 아니라 작업을 수행하고 종료하는 일회성 프로그램이다.
문단과 정답을 읽고 모델을 불러온 뒤, 없는 문서 벡터만 생성해 저장하고 검색·평가 결과를 JSON으로 남긴다.
외부 LLM 요약 생성, OpenDART 다운로드, MariaDB 접속, 실제 FastAPI 서비스 연결은 수행하지 않는다.
Chroma는 이 구성에서 별도 서버 컨테이너가 아니라 Python 프로세스가 사용하는 파일 기반 DB다.

## 참고한 공식 자료

- Chroma PersistentClient: https://docs.trychroma.com/reference/python
- KURE 모델 제공자: https://huggingface.co/nlpai-lab/KURE-v1
