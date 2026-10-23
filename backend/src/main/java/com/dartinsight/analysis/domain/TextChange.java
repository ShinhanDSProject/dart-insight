package com.dartinsight.analysis.domain;

/** 저장된 문장·표 변경. 저장소가 읽어 Service와 응답 변환이 함께 쓴다. */
public record TextChange(long id, int changeNo, TextChangeRow row) {
}
