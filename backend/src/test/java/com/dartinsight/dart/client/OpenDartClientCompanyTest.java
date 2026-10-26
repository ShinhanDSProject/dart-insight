package com.dartinsight.dart.client;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import com.dartinsight.dart.client.FakeOpenDartServer.Response;
import com.dartinsight.dart.domain.CompanyOverviewEntry;
import java.io.IOException;
import java.time.LocalDate;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class OpenDartClientCompanyTest {

    private static final String KEY = "fake-key-for-test-0000000000000000000000";

    private FakeOpenDartServer server;

    @BeforeEach
    void setUp() throws IOException {
        server = new FakeOpenDartServer();
    }

    @AfterEach
    void tearDown() {
        server.close();
    }

    private OpenDartClient client() {
        return new OpenDartClient(server.properties(KEY));
    }

    @Test
    @DisplayName("기업개황을 고유번호로 부르고 날짜·결산월을 바꾸며 빈 값은 null로 둔다")
    void readsCompanyOverview() {
        server.on("/api/company.json", Response.json(CompanyJson.SAMSUNG));

        CompanyOverviewEntry entry = client().companyOverview("00126380").orElseThrow();

        assertThat(entry.corpName()).isEqualTo("삼성전자(주)");
        assertThat(entry.corpNameEng()).isEqualTo("SAMSUNG ELECTRONICS CO,.LTD");
        assertThat(entry.stockName()).isEqualTo("삼성전자");
        assertThat(entry.stockCode()).isEqualTo("005930");
        assertThat(entry.ceoName()).isEqualTo("전영현, 노태문");
        assertThat(entry.corpClass()).isEqualTo("Y");
        assertThat(entry.indutyCode()).isEqualTo("264");
        assertThat(entry.establishedDate()).isEqualTo(LocalDate.of(1969, 1, 13));
        assertThat(entry.accountingMonth()).isEqualTo(12);
        assertThat(entry.homepageUrl()).isEqualTo("www.samsung.com/sec");
        assertThat(entry.irUrl()).isNull();
        assertThat(entry.address()).isEqualTo("경기도 수원시 영통구  삼성로 129 (매탄동)");
        assertThat(entry.phoneNumber()).isEqualTo("02-2255-0114");
        assertThat(server.requests()).singleElement().asString()
                .startsWith("/api/company.json?")
                .contains("corp_code=00126380", "crtfc_key=" + KEY);
    }

    @Test
    @DisplayName("설립일·결산월이 형식에 맞지 않으면 null로 둔다")
    void invalidDateAndMonthAreNull() {
        server.on("/api/company.json", Response.json(CompanyJson.SAMSUNG
                .replace("\"19690113\"", "\"1969\"").replace("\"acc_mt\":\"12\"", "\"acc_mt\":\"13\"")));

        CompanyOverviewEntry entry = client().companyOverview("00126380").orElseThrow();

        assertThat(entry.establishedDate()).isNull();
        assertThat(entry.accountingMonth()).isNull();
    }

    @Test
    @DisplayName("013(자료 없음)은 에러가 아니라 빈 결과다")
    void noDataIsEmpty() {
        server.on("/api/company.json", Response.json(CompanyJson.NO_DATA));

        Optional<CompanyOverviewEntry> entry = client().companyOverview("99999999");

        assertThat(entry).isEmpty();
    }

    @Test
    @DisplayName("호출 한도 초과(020)는 DART_RATE_LIMITED, 그 밖의 상태는 DART_REQUEST_FAILED다")
    void statusErrorsBecomeErrorCodes() {
        server.on("/api/company.json", Response.json(CompanyJson.status("020", "요청 제한을 초과하였습니다.")),
                Response.json(CompanyJson.status("100", "필드의 부적절한 값입니다.")));

        assertThatThrownBy(() -> client().companyOverview("00126380"))
                .isInstanceOfSatisfying(ApiException.class,
                        e -> assertThat(e.errorCode()).isEqualTo(ErrorCode.DART_RATE_LIMITED));
        assertThatThrownBy(() -> client().companyOverview("00126380"))
                .isInstanceOfSatisfying(ApiException.class,
                        e -> assertThat(e.errorCode()).isEqualTo(ErrorCode.DART_REQUEST_FAILED));
    }
}
