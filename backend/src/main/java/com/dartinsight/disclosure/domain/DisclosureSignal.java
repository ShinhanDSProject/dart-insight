package com.dartinsight.disclosure.domain;

/**
 * 확인해 볼 공시 한 건.
 *
 * @param disclosure 근거 공시(최근 공시 목록의 한 건). 감사 두 종류는 그 사업보고서
 * @param sentence   코드가 만든 사실 문장
 */
public record DisclosureSignal(DisclosureSignalKind kind, Disclosure disclosure, String sentence) {
}
