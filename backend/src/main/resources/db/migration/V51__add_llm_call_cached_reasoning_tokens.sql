-- llm_call: 입력 중 캐시에서 읽은 토큰, 출력 중 추론 토큰(#633, docs/erd.md llm_call). 모르면 null
ALTER TABLE llm_call ADD COLUMN cached_input_tokens INT;
ALTER TABLE llm_call ADD COLUMN reasoning_tokens INT;
