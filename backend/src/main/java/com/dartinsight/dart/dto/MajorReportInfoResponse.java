package com.dartinsight.dart.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;
import java.util.Map;

/**
 * OpenDART 주요사항보고서 주요정보(DS005) 응답의 공통 모양. 행의 필드는 API마다 달라(유상증자·전환사채·자기주식 등)
 * 필드 이름 → 원문 값(문자열) 그대로 받는다. 어떤 필드를 쓸지는 부르는 쪽의 규칙표가 정한다.
 * https://opendart.fss.or.kr/guide/main.do?apiGrpCd=DS005
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record MajorReportInfoResponse(String status, String message, List<Map<String, String>> list)
        implements OpenDartStatus {
}
