package com.dartinsight.dart.dto;

/**
 * 본문에 status·message가 있는 OpenDART JSON 응답. {@code OpenDartClient.fetchJson}이 status를 확인한다.
 */
public interface OpenDartStatus {

    String status();

    String message();
}
