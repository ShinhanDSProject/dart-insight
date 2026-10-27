package com.dartinsight.aiserver.client;

/**
 * FastAPI 내부 API 경로(docs/api-spec.md 3장). backend가 ai-server를 부르는 경로는 여기에만 둔다.
 * ai-server의 라우터(ai-server/app/api/*.py)와 짝이 맞아야 하므로, 경로를 바꾸면 두 곳을 같은 PR에서 고친다.
 */
public final class AiServerPaths {

    public static final String HEALTH = "/internal/health";
    public static final String TEXT_CHANGES = "/internal/text-changes";
    public static final String SUMMARIES = "/internal/summaries";
    public static final String ANSWERS = "/internal/answers";
    public static final String BRIEFINGS = "/internal/briefings";
    public static final String OUTLOOKS = "/internal/outlooks";
    public static final String DOCUMENT_PARSER = "/internal/documents/parser";

    private AiServerPaths() {
    }

    /** 원문 ZIP 구조화. 경로 인코딩은 {@link AiServerClient}의 RestClient가 하므로 여기서는 하지 않는다 */
    public static String documentStructure(String rceptNo) {
        return "/internal/documents/" + rceptNo + "/structure";
    }
}
