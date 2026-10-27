package com.dartinsight.datagokr.dto;

import java.time.LocalDate;

/** 주식시세 응답 한 줄에서 쓰는 값. 시가총액은 순위를 정하는 데만 쓴다(ADR-0033). */
public record StockPriceRow(LocalDate baseDate, String stockCode, String name, String market, long marketCap) {}
