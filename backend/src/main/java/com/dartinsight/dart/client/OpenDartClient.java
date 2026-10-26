package com.dartinsight.dart.client;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import com.dartinsight.dart.config.OpenDartProperties;
import com.dartinsight.dart.domain.CompanyOverviewEntry;
import com.dartinsight.dart.dto.DartCompanyResponse;
import com.dartinsight.dart.dto.DisclosureListResponse;
import com.dartinsight.dart.dto.FinancialStatementResponse;
import com.dartinsight.dart.dto.OpenDartStatus;
import com.dartinsight.dart.dto.KeyAccountResponse;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Supplier;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * OpenDART 호출. 인증키는 요청 주소에만 넣고 로그·에러 메시지에는 남기지 않는다.
 * 응답 본문의 status를 확인해 오류를 정해진 에러 코드로 바꾼다.
 */
@Component
public class OpenDartClient {

    private static final Logger log = LoggerFactory.getLogger(OpenDartClient.class);
    private static final Pattern XML_STATUS = Pattern.compile("<status>\\s*(\\d+)\\s*</status>");
    private static final Pattern XML_MESSAGE = Pattern.compile("<message>(.*?)</message>", Pattern.DOTALL);
    private static final Pattern JSON_STATUS = Pattern.compile("\"status\"\\s*:\\s*\"(\\d+)\"");
    private static final Pattern JSON_MESSAGE = Pattern.compile("\"message\"\\s*:\\s*\"(.*?)\"");
    static final String OK = "000";
    static final String NO_DATA = "013";
    static final String NO_FILE = "014";
    private static final int PAGE_SIZE = 100;
    private static final int MAX_PAGES = 50;

    private final OpenDartProperties properties;
    private final RestClient restClient;

    public OpenDartClient(OpenDartProperties properties) {
        this.properties = properties;
        HttpClient httpClient = HttpClient.newBuilder()
                .connectTimeout(properties.connectTimeout())
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(properties.readTimeout());
        this.restClient = RestClient.builder()
                .baseUrl(properties.baseUrl())
                .requestFactory(requestFactory)
                .build();
    }

    /** 고유번호 목록(corpCode.xml). ZIP 파일 그대로 돌려준다. */
    public byte[] downloadCorpCodes() {
        requireApiKey();
        byte[] body = execute("corpCode.xml", () -> restClient.get()
                .uri(uri -> uri.path(OpenDartPaths.CORP_CODE).queryParam("crtfc_key", properties.apiKey()).build())
                .retrieve()
                .body(byte[].class));
        if (body == null || !isZip(body)) {
            throw errorFromXml(body);
        }
        return body;
    }

    /**
     * 정기공시(pblntf_ty=A) 중 최종보고서(last_reprt_at=Y) 목록. 페이지를 끝까지 받는다.
     * 자료가 없으면(013) 빈 목록이다.
     */
    public List<DisclosureListResponse.Item> listPeriodicDisclosures(String corpCode, LocalDate begin, LocalDate end) {
        requireApiKey();
        List<DisclosureListResponse.Item> all = new ArrayList<>();
        for (int page = 1; page <= MAX_PAGES; page++) {
            int pageNo = page;
            DisclosureListResponse response = execute("list.json", () -> restClient.get()
                    .uri(uri -> uri.path(OpenDartPaths.DISCLOSURE_LIST)
                            .queryParam("crtfc_key", properties.apiKey())
                            .queryParam("corp_code", corpCode)
                            .queryParam("bgn_de", begin.format(DateTimeFormatter.BASIC_ISO_DATE))
                            .queryParam("end_de", end.format(DateTimeFormatter.BASIC_ISO_DATE))
                            .queryParam("pblntf_ty", "A")
                            .queryParam("last_reprt_at", "Y")
                            .queryParam("page_no", pageNo)
                            .queryParam("page_count", PAGE_SIZE)
                            .build())
                    .retrieve()
                    .body(DisclosureListResponse.class));
            if (response == null) {
                throw new ApiException(ErrorCode.DART_REQUEST_FAILED, "OpenDART 응답이 비어 있습니다.");
            }
            if (NO_DATA.equals(response.status())) {
                return all;
            }
            if (!OK.equals(response.status())) {
                throw statusError(response.status(), response.message());
            }
            if (response.list() != null) {
                all.addAll(response.list());
            }
            int totalPage = response.totalPage() == null ? 1 : response.totalPage();
            if (page >= totalPage) {
                break;
            }
            if (page == MAX_PAGES) {
                log.warn("공시 목록이 {}페이지를 넘어 앞의 {}페이지만 받았습니다: {} (전체 {}페이지)", MAX_PAGES, MAX_PAGES,
                        corpCode, totalPage);
            }
        }
        return all;
    }

    /**
     * 단일회사 전체 재무제표. 자료가 없으면(013) noData가 true이고 목록은 비어 있다.
     *
     * @param reprtCode 11011 사업, 11012 반기, 11013 1분기, 11014 3분기
     * @param fsDiv     CFS 연결, OFS 별도
     */
    public FinancialStatementPage financialStatements(String corpCode, int fiscalYear, String reprtCode,
            String fsDiv) {
        requireApiKey();
        FinancialStatementResponse response = execute("fnlttSinglAcntAll.json", () -> restClient.get()
                .uri(uri -> uri.path(OpenDartPaths.FINANCIAL_STATEMENTS)
                        .queryParam("crtfc_key", properties.apiKey())
                        .queryParam("corp_code", corpCode)
                        .queryParam("bsns_year", fiscalYear)
                        .queryParam("reprt_code", reprtCode)
                        .queryParam("fs_div", fsDiv)
                        .build())
                .retrieve()
                .body(FinancialStatementResponse.class));
        if (response == null) {
            throw new ApiException(ErrorCode.DART_REQUEST_FAILED, "OpenDART 응답이 비어 있습니다.");
        }
        if (NO_DATA.equals(response.status())) {
            return new FinancialStatementPage(true, List.of());
        }
        if (!OK.equals(response.status())) {
            throw statusError(response.status(), response.message());
        }
        return new FinancialStatementPage(false, response.list() == null ? List.of() : response.list());
    }

    /**
     * 단일회사 주요계정(fnlttSinglAcnt.json). 연결(CFS)·별도(OFS) 줄이 함께 온다.
     * 자료가 없으면(013) noData가 true이고 목록은 비어 있다.
     * https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS003&apiId=2019016
     *
     * @param reprtCode 11011 사업, 11012 반기, 11013 1분기, 11014 3분기
     */
    public KeyAccountPage keyAccounts(String corpCode, int fiscalYear, String reprtCode) {
        requireApiKey();
        KeyAccountResponse response = execute("fnlttSinglAcnt.json", () -> restClient.get()
                .uri(uri -> uri.path(OpenDartPaths.KEY_ACCOUNTS)
                        .queryParam("crtfc_key", properties.apiKey())
                        .queryParam("corp_code", corpCode)
                        .queryParam("bsns_year", fiscalYear)
                        .queryParam("reprt_code", reprtCode)
                        .build())
                .retrieve()
                .body(KeyAccountResponse.class));
        if (response == null) {
            throw new ApiException(ErrorCode.DART_REQUEST_FAILED, "OpenDART 응답이 비어 있습니다.");
        }
        if (NO_DATA.equals(response.status())) {
            return new KeyAccountPage(true, List.of());
        }
        if (!OK.equals(response.status())) {
            throw statusError(response.status(), response.message());
        }
        return new KeyAccountPage(false, response.list() == null ? List.of() : response.list());
    }

    /** @param noData OpenDART가 '자료 없음'(013)으로 답했는지 */
    public record KeyAccountPage(boolean noData, List<KeyAccountResponse.Item> items) {
    }

    /**
     * 기업개황(company.json). 자료가 없으면(013) 빈 Optional이다.
     * 값은 앞뒤 공백만 지우고 빈 문자열은 null, 설립일(YYYYMMDD)·결산월(MM)이 형식에 맞지 않으면 null로 둔다.
     */
    public Optional<CompanyOverviewEntry> companyOverview(String corpCode) {
        return fetchJson(OpenDartPaths.COMPANY, Map.of("corp_code", corpCode), DartCompanyResponse.class)
                .map(r -> new CompanyOverviewEntry(
                        clean(r.corpName()), clean(r.corpNameEng()), clean(r.stockName()), clean(r.stockCode()),
                        clean(r.ceoNm()), clean(r.corpCls()), clean(r.indutyCode()), parseBasicDate(r.estDt()),
                        parseMonth(r.accMt()), clean(r.hmUrl()), clean(r.irUrl()), clean(r.adres()),
                        clean(r.phnNo())));
    }

    /**
     * 한 번 부르면 끝나는 JSON API를 부르고 본문 status를 확인한다. 000이면 응답, 013(자료 없음)이면 빈 Optional,
     * 그 밖은 정해진 에러(statusError)다. 새 OpenDART JSON API는 응답 record가 {@link OpenDartStatus}를 구현하고
     * 이 메서드로 부른다(ADR-0024).
     *
     * @param path   {@link OpenDartPaths}의 경로
     * @param params 인증키를 뺀 요청 인자
     */
    <T extends OpenDartStatus> Optional<T> fetchJson(String path, Map<String, ?> params, Class<T> type) {
        requireApiKey();
        String name = path.substring(path.lastIndexOf('/') + 1);
        T response = execute(name, () -> restClient.get()
                .uri(uri -> {
                    uri.path(path).queryParam("crtfc_key", properties.apiKey());
                    params.forEach((key, value) -> uri.queryParam(key, value));
                    return uri.build();
                })
                .retrieve()
                .body(type));
        if (response == null) {
            throw new ApiException(ErrorCode.DART_REQUEST_FAILED, "OpenDART 응답이 비어 있습니다.");
        }
        if (NO_DATA.equals(response.status())) {
            return Optional.empty();
        }
        if (!OK.equals(response.status())) {
            throw statusError(response.status(), response.message());
        }
        return Optional.of(response);
    }

    private static String clean(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.strip();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static LocalDate parseBasicDate(String value) {
        String text = clean(value);
        if (text == null) {
            return null;
        }
        try {
            return LocalDate.parse(text, DateTimeFormatter.BASIC_ISO_DATE);
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private static Integer parseMonth(String value) {
        String text = clean(value);
        if (text == null || !text.matches("\\d{1,2}")) {
            return null;
        }
        int month = Integer.parseInt(text);
        return month >= 1 && month <= 12 ? month : null;
    }

    /**
     * 공시서류원본파일(document.xml). 접수번호의 원문 ZIP을 그대로 돌려준다.
     * 자료가 없으면(013 조회된 데이터 없음, 014 파일이 존재하지 않음) available이 false다. 그 밖의 상태는 에러.
     */
    public DocumentFile downloadDocument(String rceptNo) {
        requireApiKey();
        byte[] body = execute("document.xml", () -> restClient.get()
                .uri(uri -> uri.path(OpenDartPaths.DOCUMENT)
                        .queryParam("crtfc_key", properties.apiKey())
                        .queryParam("rcept_no", rceptNo)
                        .build())
                .retrieve()
                .body(byte[].class));
        if (body != null && isZip(body)) {
            return new DocumentFile(true, body, OK, null);
        }
        String text = body == null ? "" : new String(body, StandardCharsets.UTF_8);
        String status = find(text, XML_STATUS, JSON_STATUS);
        String message = find(text, XML_MESSAGE, JSON_MESSAGE);
        if (NO_DATA.equals(status) || NO_FILE.equals(status)) {
            return new DocumentFile(false, null, status, message);
        }
        if (status != null) {
            throw statusError(status, message);
        }
        throw new ApiException(ErrorCode.DART_REQUEST_FAILED, "OpenDART 원문 응답을 읽을 수 없습니다.");
    }

    /**
     * 원문 파일 받기 결과.
     *
     * @param available 원문 ZIP을 받았는지. false면 status(013·014)와 message가 사유
     */
    public record DocumentFile(boolean available, byte[] zip, String status, String message) {
    }

    private static String find(String text, Pattern... patterns) {
        for (Pattern pattern : patterns) {
            Matcher matcher = pattern.matcher(text);
            if (matcher.find()) {
                return matcher.group(1).trim();
            }
        }
        return null;
    }

    /** @param noData OpenDART가 '자료 없음'(013)으로 답했는지 */
    public record FinancialStatementPage(boolean noData, List<FinancialStatementResponse.Item> items) {
    }

    void requireApiKey() {
        if (!properties.hasApiKey()) {
            throw new ApiException(ErrorCode.DART_KEY_MISSING);
        }
    }

    /** 네트워크 오류와 5xx는 정해진 횟수만큼 다시 시도한다. */
    <T> T execute(String name, Supplier<T> call) {
        int attempt = 0;
        while (true) {
            try {
                return call.get();
            } catch (ResourceAccessException | HttpServerErrorException e) {
                attempt++;
                if (attempt > properties.maxRetries()) {
                    log.warn("OpenDART {} 호출 실패({}회 시도): {}", name, attempt, mask(e.getMessage()));
                    throw new ApiException(ErrorCode.DART_REQUEST_FAILED);
                }
                log.info("OpenDART {} 호출 재시도 {}/{}", name, attempt, properties.maxRetries());
                sleep(500L * attempt);
            } catch (RestClientException e) {
                log.warn("OpenDART {} 호출 실패: {}", name, mask(e.getMessage()));
                throw new ApiException(ErrorCode.DART_REQUEST_FAILED);
            }
        }
    }

    /**
     * OpenDART 상태 코드를 에러로 바꾼다. 000(정상)과 013(자료 없음)은 호출한 쪽에서 처리한다.
     */
    static ApiException statusError(String status, String message) {
        String detail = "OpenDART 응답 오류(" + status + "): " + (message == null ? "" : message);
        if ("020".equals(status)) {
            return new ApiException(ErrorCode.DART_RATE_LIMITED, ErrorCode.DART_RATE_LIMITED.defaultMessage());
        }
        return new ApiException(ErrorCode.DART_REQUEST_FAILED, detail);
    }

    private ApiException errorFromXml(byte[] body) {
        String text = body == null ? "" : new String(body, StandardCharsets.UTF_8);
        Matcher status = XML_STATUS.matcher(text);
        Matcher message = XML_MESSAGE.matcher(text);
        if (status.find()) {
            return statusError(status.group(1), message.find() ? message.group(1).trim() : null);
        }
        return new ApiException(ErrorCode.DART_REQUEST_FAILED, "OpenDART 응답을 읽을 수 없습니다.");
    }

    private static boolean isZip(byte[] body) {
        return body.length >= 4 && body[0] == 'P' && body[1] == 'K' && body[2] == 3 && body[3] == 4;
    }

    /** 로그에 인증키가 남지 않게 가린다. */
    String mask(String text) {
        if (text == null || !properties.hasApiKey()) {
            return text;
        }
        return text.replace(properties.apiKey(), "***");
    }

    private static void sleep(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ApiException(ErrorCode.DART_REQUEST_FAILED);
        }
    }
}
