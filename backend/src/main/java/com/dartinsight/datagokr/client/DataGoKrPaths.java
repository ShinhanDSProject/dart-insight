package com.dartinsight.datagokr.client;

/**
 * 공공데이터포털 외부 API 경로. {@link StockPriceClient}가 부르는 경로는 여기에만 둔다.
 */
public final class DataGoKrPaths {

    /** 금융위원회_주식시세정보 · 주식시세(V2). 지금 활용신청으로 받는 키는 예전 경로(/service/...Service/getStockPriceInfo)에 등록되지 않는다 */
    public static final String STOCK_PRICE = "/1160100/GetStockSecuritiesInfoService_V2/getStockPriceInfo_V2";

    private DataGoKrPaths() {
    }
}
