package com.dartinsight.datagokr.client;

/**
 * 공공데이터포털 외부 API 경로. {@link StockPriceClient}가 부르는 경로는 여기에만 둔다.
 */
public final class DataGoKrPaths {

    /** 금융위원회_주식시세정보 · 주식시세 */
    public static final String STOCK_PRICE = "/1160100/service/GetStockSecuritiesInfoService/getStockPriceInfo";

    private DataGoKrPaths() {
    }
}
