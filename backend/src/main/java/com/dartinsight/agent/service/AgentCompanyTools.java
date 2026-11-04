package com.dartinsight.agent.service;

import static com.dartinsight.agent.domain.Schemas.object;
import static com.dartinsight.agent.domain.Schemas.oneOf;
import static com.dartinsight.agent.domain.Schemas.properties;
import static com.dartinsight.agent.domain.Schemas.string;

import com.dartinsight.agent.domain.Evidence;
import com.dartinsight.agent.domain.ToolArgs;
import com.dartinsight.agent.domain.ToolLine;
import com.dartinsight.agent.service.AgentTools.Output;
import com.dartinsight.agent.service.AgentTools.Tool;
import com.dartinsight.agent.domain.AgentActions;
import com.dartinsight.agent.domain.ComparabilityCheck;
import com.dartinsight.analysis.domain.Analysis;
import com.dartinsight.analysis.domain.CompletedAnalysis;
import com.dartinsight.analysis.service.CompanyAnalysisService;
import com.dartinsight.analysis.service.AnalysisResultService;
import com.dartinsight.briefing.dto.CompanyBriefingResponse;
import com.dartinsight.briefing.service.BriefingService;
import com.dartinsight.checkpoint.dto.CompanyCheckpointsResponse;
import com.dartinsight.checkpoint.service.CheckpointService;
import com.dartinsight.company.domain.Company;
import com.dartinsight.company.dto.CompanyOverviewResponse;
import com.dartinsight.company.service.CompanyOverviewService;
import com.dartinsight.company.service.CompanyService;
import com.dartinsight.disclosure.domain.Disclosure;
import com.dartinsight.disclosure.domain.DisclosureGroup;
import com.dartinsight.disclosure.domain.KeyItemStatus;
import com.dartinsight.disclosure.dto.DisclosureKeyItemsResponse;
import com.dartinsight.disclosure.dto.DisclosureSignalsResponse;
import com.dartinsight.disclosure.service.DisclosureKeyItemService;
import com.dartinsight.disclosure.service.DisclosureService;
import com.dartinsight.disclosure.service.DisclosureSignalService;
import com.dartinsight.financial.domain.FsDiv;
import com.dartinsight.financial.dto.FinancialTrendResponse;
import com.dartinsight.financial.service.FinancialTrendService;
import com.dartinsight.followup.dto.CompanyPlanFollowupResponse;
import com.dartinsight.followup.service.PlanFollowupService;
import com.dartinsight.keyfact.domain.KeyFactChange;
import com.dartinsight.keyfact.domain.KeyFactSection;
import com.dartinsight.keyfact.domain.MajorShareholder;
import com.dartinsight.keyfact.dto.KeyFactsResponse;
import com.dartinsight.keyfact.service.KeyFactService;
import com.dartinsight.outlook.domain.OutlookItem;
import com.dartinsight.outlook.dto.CompanyOutlookResponse;
import com.dartinsight.outlook.service.OutlookService;
import com.dartinsight.comparison.domain.ComparisonBasis;
import com.dartinsight.comparison.service.ComparabilityService;
import com.dartinsight.comparison.service.ReportPairService;
import com.dartinsight.report.domain.DartLinks;
import com.dartinsight.report.domain.Report;
import com.dartinsight.summary.domain.FinancialFacts;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * 에이전트 채팅의 기업·기간 Tool(#582, docs/api-spec.md 3절 Tool 목록). 기업 화면의 기존 서비스를 부르고
 * 값은 그 API가 준 값 그대로 근거로 넘긴다. corpCode를 주지 않으면 이 분석의 기업이다.
 * 목록은 AgentTools가 분석 Tool 뒤에 붙여 한 곳에서 보낸다.
 */
@Component
@RequiredArgsConstructor
class AgentCompanyTools {

    static final String SEARCH_COMPANIES = "search_companies";
    static final String GET_COMPANY_OVERVIEW = "get_company_overview";
    static final String GET_FINANCIAL_TRENDS = "get_financial_trends";
    static final String GET_KEY_FACTS = "get_key_facts";
    static final String GET_CHECKPOINTS = "get_checkpoints";
    static final String GET_DISCLOSURES = "get_disclosures";
    static final String GET_DISCLOSURE_SIGNALS = "get_disclosure_signals";
    static final String GET_DISCLOSURE_KEY_ITEMS = "get_disclosure_key_items";
    static final String GET_COMPANY_BRIEFING = "get_company_briefing";
    static final String GET_OUTLOOK = "get_outlook";
    static final String GET_PLAN_FOLLOWUPS = "get_plan_followups";
    static final String FIND_ANALYSES = "find_analyses";
    static final String GET_REPORT_PAIRS = "get_report_pairs";
    static final String CHECK_COMPARABILITY = "check_comparability";
    /** 완료된 분석 목록 수(기업 화면 기본값과 같음) */
    static final int ANALYSES_LIMIT = 5;
    /** 보고서 쌍을 고를 수 있는 비교 기준(직접 선택 CUSTOM은 화면에서 고름) */
    private static final List<String> PAIR_BASES = List.of("YOY", "PREV");

    static final String FINANCIAL_TREND = "FINANCIAL_TREND";
    static final String KEY_FACT = "KEY_FACT";
    static final String CHECKPOINT = "CHECKPOINT";
    static final String DISCLOSURE_KEY_ITEM = "DISCLOSURE_KEY_ITEM";

    /** 기업 검색 후보 수(같은 이름이 여럿이면 고르게 묻는 데 충분한 만큼) */
    static final int SEARCH_LIMIT = 10;
    /** 공시 목록 기간(기업 화면 기본값과 같음) */
    static final int DISCLOSURE_DAYS = 90;
    /** 값이 많은 Tool의 줄 수 상한(재무 추이는 계정 × 기간) */
    static final int VALUE_ITEMS = 40;
    private static final String CORP = "corpCode";
    private static final Pattern CORP_CODE = Pattern.compile("\\d{8}");
    private static final Pattern RCEPT_NO = Pattern.compile("\\d{14}");
    private static final List<String> GROUPS = Arrays.stream(DisclosureGroup.values()).map(Enum::name).toList();

    private final AnalysisResultService analysisResultService;
    private final CompanyService companyService;
    private final CompanyOverviewService overviewService;
    private final FinancialTrendService trendService;
    private final KeyFactService keyFactService;
    private final CheckpointService checkpointService;
    private final DisclosureService disclosureService;
    private final DisclosureSignalService signalService;
    private final DisclosureKeyItemService keyItemService;
    private final BriefingService briefingService;
    private final OutlookService outlookService;
    private final PlanFollowupService followupService;
    private final CompanyAnalysisService companyAnalysisService;
    private final ReportPairService reportPairService;
    private final ComparabilityService comparabilityService;

    List<Tool> all() {
        Map<String, Object> corpOnly = object(properties(CORP, corpSchema()), List.of());
        return List.of(
                new Tool(SEARCH_COMPANIES, "기업 이름·종목코드로 기업을 찾는다. 같은 이름이 여럿이면 하나로 정하지 말고 후보를 "
                        + "인용해 어느 기업인지 묻는다", object(properties("query", string("기업 이름이나 종목코드(2~50자)")),
                        List.of("query")), 0, (a, args) -> Output.of(searchCompanies(args))),
                new Tool(GET_COMPANY_OVERVIEW, "기업 개황(대표자·설립일·결산월·업종·주소 등)", corpOnly, 0,
                        (a, args) -> Output.of(overview(a, args))),
                new Tool(GET_FINANCIAL_TRENDS, "최근 정기보고서의 주요 계정(매출·영업이익 등) 추이(연결)", corpOnly, VALUE_ITEMS,
                        (a, args) -> Output.of(trends(a, args))),
                new Tool(GET_KEY_FACTS, "최근 두 정기보고서의 최대주주·임원·배당과 그 변화", corpOnly, VALUE_ITEMS,
                        (a, args) -> Output.of(keyFacts(a, args))),
                new Tool(GET_CHECKPOINTS, "체크 포인트(재무 위험 신호와 계속기업 관련 사항)의 상태와 값", corpOnly, VALUE_ITEMS,
                        (a, args) -> Output.of(checkpoints(a, args))),
                new Tool(GET_DISCLOSURES, "최근 " + DISCLOSURE_DAYS + "일 공시 목록(제목·접수일)", object(properties(CORP, corpSchema(),
                        "group", oneOf("공시 묶음. PERIODIC 정기보고서, OWNERSHIP 지분 변동, FUNDING 자금 조달, "
                                + "GOVERNANCE 지배구조, BUSINESS 실적·영업, OTHER 기타", GROUPS)), List.of()), 0,
                        (a, args) -> Output.of(disclosures(a, args))),
                new Tool(GET_DISCLOSURE_SIGNALS, "확인해 볼 공시 신호(유상증자·최대주주 변경 등)와 그 공시", corpOnly, 0,
                        (a, args) -> Output.of(signals(a, args))),
                new Tool(GET_DISCLOSURE_KEY_ITEMS, "수시공시 하나의 주요정보(OpenDART DS005 값)", object(properties(CORP, corpSchema(),
                        "rceptNo", string("수시공시 접수번호(14자리)")), List.of("rceptNo")), 0,
                        (a, args) -> Output.of(keyItems(a, args))),
                new Tool(GET_COMPANY_BRIEFING, "최근 정기보고서의 기업 브리핑(원문 인용 포함). 저장된 것이 없으면 새로 만들어 "
                        + "오래 걸릴 수 있다", corpOnly, 0, (a, args) -> Output.of(briefing(a, args))),
                new Tool(GET_OUTLOOK, "최근 사업보고서에서 회사가 밝힌 전망·계획(원문 인용 포함). 저장된 것이 없으면 새로 만든다",
                        corpOnly, 0, (a, args) -> Output.of(outlook(a, args))),
                new Tool(GET_PLAN_FOLLOWUPS, "작년 사업보고서의 계획과 올해 사업보고서의 관련 문단 대조. 저장된 것이 없으면 새로 "
                        + "만든다", corpOnly, VALUE_ITEMS, (a, args) -> Output.of(planFollowups(a, args))),
                new Tool(FIND_ANALYSES, "이 기업의 완료된 분석(최근 " + ANALYSES_LIMIT + "개)과 그 보고서 쌍. 같은 보고서 쌍의 "
                        + "끝난 분석이 있으면 OPEN_ANALYSIS로 연다", corpOnly, 0, (a, args) -> Output.of(analyses(a, args))),
                new Tool(GET_REPORT_PAIRS, "비교 기준(YOY 전년 동기, PREV 직전 기간)에 맞는 최근 보고서와 이전 보고서",
                        object(properties(CORP, corpSchema(), "basis", oneOf("비교 기준", PAIR_BASES)),
                                List.of("basis")), 0, (a, args) -> Output.of(reportPair(a, args))),
                new Tool(CHECK_COMPARABILITY, "두 보고서를 비교할 수 있는지와 그 이유. 비교할 수 있을 때만 "
                        + "CONFIRM_REQUEST_ANALYSIS(분석 요청 확인 버튼)를 돌려줄 수 있다", object(properties(CORP,
                        corpSchema(), "previousRceptNo", string("이전 보고서 접수번호(14자리)"),
                        "currentRceptNo", string("현재 보고서 접수번호(14자리)"), "basis", oneOf("비교 기준",
                        AgentActions.BASES)), List.of("previousRceptNo", "currentRceptNo", "basis")), 0,
                        this::comparability));
    }

    private static Map<String, Object> corpSchema() {
        return string("기업 고유번호(8자리). 없으면 이 분석의 기업");
    }

    private List<ToolLine> searchCompanies(ToolArgs args) {
        String query = args.string("query");
        if (query == null || query.length() < 2 || query.length() > 50) {
            throw new IllegalArgumentException("query는 2~50자여야 합니다.");
        }
        List<Company> found = companyService.search(query, SEARCH_LIMIT);
        if (found.isEmpty()) {
            return List.of(new ToolLine(null, "'" + query + "'로 찾은 기업이 없어요."));
        }
        List<ToolLine> lines = new ArrayList<>();
        if (found.size() > 1) {
            lines.add(new ToolLine(null, "찾은 기업이 " + found.size() + "곳이에요. 하나로 정하지 말고 어느 기업인지 물어보세요."));
        }
        for (Company c : found) {
            lines.add(new ToolLine(Evidence.company(c.getCorpCode(), c.getCorpName(), "기업 검색", c.getStockCode()),
                    "[기업 검색] " + c.getCorpName() + " (고유번호 " + c.getCorpCode() + ", "
                            + (c.getStockCode() == null ? "비상장" : "종목코드 " + c.getStockCode()) + ")"));
        }
        return lines;
    }

    private List<ToolLine> overview(Long analysisId, ToolArgs args) {
        String corpCode = corpCode(analysisId, args);
        CompanyOverviewResponse o = CompanyOverviewResponse.from(overviewService.get(corpCode));
        if (!o.available()) {
            return List.of(new ToolLine(null, "기업 개황 자료를 받지 못했어요."));
        }
        String text = "[기업 개황] " + o.corpName() + ", 대표자 " + o.ceoName() + ", 법인 구분 " + o.corpClass()
                + ", 업종코드 " + o.indutyCode() + ", 설립일 " + o.establishedDate() + ", 결산월 " + o.accountingMonth()
                + "월, 주소 " + o.address() + ", 홈페이지 " + o.homepageUrl();
        return List.of(new ToolLine(Evidence.company(corpCode, o.corpName(), "기업 개황", null), text));
    }

    /** 계정마다 최근 기간부터 한 값씩. 값의 근거 접수번호는 그 기간의 sourceRceptNo(있으면) */
    private List<ToolLine> trends(Long analysisId, ToolArgs args) {
        String corpCode = corpCode(analysisId, args);
        FinancialTrendResponse trend = FinancialTrendResponse.from(
                trendService.trend(corpCode, FsDiv.CFS, FinancialTrendService.DEFAULT_LIMIT));
        Map<String, FinancialTrendResponse.Period> periods = new HashMap<>();
        trend.periods().forEach(p -> periods.put(p.rceptNo(), p));
        List<ToolLine> lines = new ArrayList<>();
        for (FinancialTrendResponse.Account account : trend.accounts()) {
            for (FinancialTrendResponse.Value v : account.values().reversed()) {
                FinancialTrendResponse.Period period = periods.get(v.rceptNo());
                if (v.amount() == null || period == null) {
                    continue;
                }
                String source = period.sourceRceptNo() != null ? period.sourceRceptNo() : period.rceptNo();
                lines.add(new ToolLine(Evidence.reportValue(source, period.reportName(), DartLinks.viewer(source),
                        FINANCIAL_TREND, account.name(), v.amount(), null, v.currency()),
                        "[재무 추이, 연결] " + period.reportName() + " " + account.name() + ": "
                                + FinancialFacts.amount(v.amount(), v.currency())));
            }
        }
        if (lines.isEmpty()) {
            lines.add(new ToolLine(null, "재무 추이 자료가 없어요."));
        }
        return lines;
    }

    /** 변화를 먼저, 그다음 현재 보고서의 최대주주 지분율과 배당 */
    private List<ToolLine> keyFacts(Long analysisId, ToolArgs args) {
        KeyFactsResponse facts = KeyFactsResponse.from(keyFactService.keyFacts(corpCode(analysisId, args)));
        if (facts.current() == null) {
            return List.of(new ToolLine(null, "최대주주·임원·배당을 볼 정기보고서가 없어요."));
        }
        List<ToolLine> lines = new ArrayList<>();
        if (facts.previousReason() != null) {
            lines.add(new ToolLine(null, "[주요 사실] 비교할 이전 보고서 없음: " + facts.previousReason().message()));
        }
        changes(lines, "최대주주", facts.majorShareholders(), facts);
        changes(lines, "임원", facts.executives(), facts);
        changes(lines, "배당", facts.dividends(), facts);
        KeyFactSection<MajorShareholder> holders = facts.majorShareholders().current();
        if (holders != null && holders.available()) {
            String rceptNo = source(holders, facts.current().rceptNo());
            for (MajorShareholder h : holders.rows()) {
                String label = "최대주주 " + h.name() + "(" + h.relation() + ") " + h.stockKind() + " 기말 지분율";
                lines.add(new ToolLine(Evidence.reportValue(rceptNo, facts.current().reportName(),
                        DartLinks.viewer(rceptNo), KEY_FACT, label, h.endRatio(), "%", null),
                        "[최대주주, " + facts.current().reportName() + "] " + label + ": " + h.endRatio() + "%"));
            }
        } else {
            lines.add(new ToolLine(null, "[최대주주] 현재 보고서 자료 없음"));
        }
        return lines;
    }

    private static <T> void changes(List<ToolLine> lines, String group, KeyFactsResponse.GroupResponse<T> section,
            KeyFactsResponse facts) {
        if (section.current() == null || !section.current().available()) {
            return;
        }
        String rceptNo = source(section.current(), facts.current().rceptNo());
        String between = facts.previous() == null ? facts.current().reportName()
                : facts.previous().reportName() + " → " + facts.current().reportName();
        for (KeyFactChange c : section.changes()) {
            String label = group + " 변화(" + c.type() + ") " + c.name()
                    + (c.stockKind() == null ? "" : " " + c.stockKind()) + (c.field() == null ? "" : " " + c.field());
            String after = c.type() == KeyFactChange.Type.REMOVED ? null : c.after();
            lines.add(new ToolLine(Evidence.reportValue(rceptNo, facts.current().reportName(), DartLinks.viewer(rceptNo),
                    KEY_FACT, label, after, null, null), "[" + group + " 변화, " + between + "] " + label + ": "
                    + c.before() + " → " + c.after()));
        }
    }

    private static String source(KeyFactSection<?> section, String fallback) {
        return section.sourceRceptNo() != null ? section.sourceRceptNo()
                : section.rceptNo() != null ? section.rceptNo() : fallback;
    }

    private List<ToolLine> checkpoints(Long analysisId, ToolArgs args) {
        CompanyCheckpointsResponse result = CompanyCheckpointsResponse.from(
                checkpointService.get(corpCode(analysisId, args)));
        if (!"AVAILABLE".equals(result.status())) {
            return List.of(new ToolLine(null, "체크 포인트를 볼 수 없어요: " + result.message()));
        }
        String report = result.currentReport() == null ? null : result.currentReport().rceptNo();
        String reportName = result.currentReport() == null ? null : result.currentReport().reportName();
        List<ToolLine> lines = new ArrayList<>();
        for (CompanyCheckpointsResponse.Item item : result.items()) {
            String head = "[체크 포인트 " + item.title() + ", " + item.statusLabel() + "] ";
            if (item.facts().isEmpty()) {
                lines.add(new ToolLine(null, head + (item.note() == null ? "" : item.note())));
                continue;
            }
            for (CompanyCheckpointsResponse.Fact f : item.facts()) {
                String rceptNo = f.evidence() != null ? f.evidence().rceptNo()
                        : f.quote() != null ? f.quote().rceptNo() : report;
                String unit = f.unit() == null ? null : f.unit().name();
                String shown = f.value() == null ? "자료 없음(" + f.reason() + ")" : f.value().toPlainString()
                        + (unit == null ? "" : " " + unit) + (f.currency() == null ? "" : " " + f.currency());
                String quote = f.quote() == null ? "" : " 원문: " + f.quote().text();
                lines.add(new ToolLine(rceptNo == null ? null : Evidence.reportValue(rceptNo, reportName,
                        DartLinks.viewer(rceptNo), CHECKPOINT, item.title() + " · " + f.label(), f.value(), unit,
                        f.currency()), head + f.label() + ": " + shown + quote));
            }
        }
        return lines;
    }

    private List<ToolLine> disclosures(Long analysisId, ToolArgs args) {
        String group = args.choice("group", GROUPS, null);
        DisclosureService.DisclosureTimeline timeline = disclosureService.timeline(corpCode(analysisId, args),
                DISCLOSURE_DAYS, group == null ? null : DisclosureGroup.valueOf(group));
        if (timeline.items().isEmpty()) {
            return List.of(new ToolLine(null, "최근 " + DISCLOSURE_DAYS + "일 동안 공시가 없어요."));
        }
        return timeline.items().stream().map(AgentCompanyTools::disclosureLine).toList();
    }

    private static ToolLine disclosureLine(Disclosure d) {
        String rceptDt = d.rceptDt() == null ? null : d.rceptDt().toString();
        return new ToolLine(Evidence.disclosure(d.rceptNo(), d.displayName(), rceptDt, DartLinks.viewer(d.rceptNo())),
                "[공시 " + rceptDt + ", 접수번호 " + d.rceptNo() + "] " + d.displayName());
    }

    private List<ToolLine> signals(Long analysisId, ToolArgs args) {
        DisclosureSignalsResponse result = DisclosureSignalsResponse.from(
                signalService.signals(corpCode(analysisId, args)));
        if (result.items().isEmpty()) {
            return List.of(new ToolLine(null, result.from() + "~" + result.to() + " 확인해 볼 공시 신호가 없어요."));
        }
        return result.items().stream().map(i -> {
            String rceptDt = i.receivedDate() == null ? null : i.receivedDate().toString();
            return new ToolLine(Evidence.disclosure(i.rceptNo(), i.reportName(), rceptDt, i.dartUrl()),
                    "[공시 신호 " + i.kind().label() + ", " + rceptDt + ", 접수번호 " + i.rceptNo() + "] "
                            + i.reportName() + ": " + i.sentence());
        }).toList();
    }

    private List<ToolLine> keyItems(Long analysisId, ToolArgs args) {
        String rceptNo = args.string("rceptNo");
        if (rceptNo == null || !RCEPT_NO.matcher(rceptNo).matches()) {
            throw new IllegalArgumentException("rceptNo는 14자리 접수번호여야 합니다.");
        }
        DisclosureKeyItemsResponse result = DisclosureKeyItemsResponse.from(
                keyItemService.get(corpCode(analysisId, args), rceptNo));
        if (result.status() != KeyItemStatus.AVAILABLE || result.items().isEmpty()) {
            return List.of(new ToolLine(null, "[주요정보 " + result.kindLabel() + "] 자료 없음(" + result.status() + ")"));
        }
        String source = result.sourceRceptNo() != null ? result.sourceRceptNo() : result.rceptNo();
        return result.items().stream().map(i -> new ToolLine(Evidence.reportValue(source, result.kindLabel(),
                result.sourceUrl(), DISCLOSURE_KEY_ITEM, i.label(), i.value(), i.unit(), null),
                "[주요정보 " + result.kindLabel() + "] " + i.label() + ": " + i.value()
                        + (i.unit() == null ? "" : " " + i.unit()))).toList();
    }

    /** 브리핑 문장마다 인용한 원문 문단. 근거는 원문 위치이고 미리보기는 원문(AI 문장을 넣지 않음) */
    private List<ToolLine> briefing(Long analysisId, ToolArgs args) {
        Analysis analysis = analysisResultService.get(analysisId);
        CompanyBriefingResponse result = briefingService.get(corpCode(analysis, args));
        if (result.sentences() == null || result.sentences().isEmpty()) {
            return List.of(new ToolLine(null, "기업 브리핑이 없어요(" + result.status() + "): " + result.message()));
        }
        List<ToolLine> lines = new ArrayList<>();
        for (CompanyBriefingResponse.Sentence s : result.sentences()) {
            for (CompanyBriefingResponse.Evidence e : s.evidence()) {
                lines.add(new ToolLine(Evidence.block(e.evidenceId(), side(analysis, e.rceptNo()), e.rceptNo(),
                        e.sectionNo(), e.blockNo(), e.sectionPath(), e.quote()), "[브리핑 " + s.no() + ", "
                        + e.sectionPath() + "] 원문: " + e.quote() + " (AI 브리핑 문장: " + s.text() + ")"));
            }
        }
        return lines;
    }

    private List<ToolLine> outlook(Long analysisId, ToolArgs args) {
        Analysis analysis = analysisResultService.get(analysisId);
        CompanyOutlookResponse result = outlookService.get(corpCode(analysis, args));
        if (result.items() == null || result.items().isEmpty()) {
            return List.of(new ToolLine(null, "회사가 밝힌 전망·계획이 없어요(" + result.status() + "): "
                    + result.message()));
        }
        return result.items().stream().map(i -> blockLine(analysis, i.evidence(), i.quote(),
                "[전망·계획 " + i.categoryLabel() + "] 원문: " + i.quote() + " (AI 요약: " + i.summary() + ")")).toList();
    }

    private List<ToolLine> planFollowups(Long analysisId, ToolArgs args) {
        Analysis analysis = analysisResultService.get(analysisId);
        CompanyPlanFollowupResponse result = followupService.get(corpCode(analysis, args));
        if (result.items() == null || result.items().isEmpty()) {
            return List.of(new ToolLine(null, "대조할 계획이 없어요(" + result.status() + "): " + result.message()));
        }
        List<ToolLine> lines = new ArrayList<>();
        for (CompanyPlanFollowupResponse.Item item : result.items()) {
            lines.add(blockLine(analysis, item.plan().evidence(), item.plan().quote(), "[작년 계획 " + item.planNo()
                    + ", " + item.categoryLabel() + "] 원문: " + item.plan().quote()));
            CompanyPlanFollowupResponse.Followup f = item.followup();
            lines.add(f.evidence() == null
                    ? new ToolLine(null, "[올해 대조 " + item.planNo() + ", " + f.statusLabel() + "] 관련 문단 없음")
                    : blockLine(analysis, f.evidence(), f.quote(), "[올해 대조 " + item.planNo() + ", "
                            + f.statusLabel() + "] 원문: " + f.quote()));
        }
        return lines;
    }

    private static ToolLine blockLine(Analysis analysis, OutlookItem.Evidence e, String quote, String text) {
        return new ToolLine(e == null ? null : Evidence.block(e.evidenceId(), side(analysis, e.rceptNo()), e.rceptNo(),
                e.sectionNo(), e.blockNo(), e.sectionPath(), quote), text);
    }

    /** 완료된 분석마다 한 줄. 근거는 그 분석의 현재 보고서(D{접수번호}) */
    private List<ToolLine> analyses(Long analysisId, ToolArgs args) {
        List<CompletedAnalysis> found = companyAnalysisService.recentCompleted(corpCode(analysisId, args),
                ANALYSES_LIMIT);
        if (found.isEmpty()) {
            return List.of(new ToolLine(null, "이 기업의 완료된 분석이 없어요."));
        }
        return found.stream().map(c -> new ToolLine(reportEvidence(c.current()), "[완료된 분석 analysisId "
                + c.analysis().getId() + ", 기준 " + c.analysis().getBasis() + "] " + reportText(c.previous())
                + " → " + reportText(c.current()) + ", 완료 " + c.analysis().getCompletedAt())).toList();
    }

    private List<ToolLine> reportPair(Long analysisId, ToolArgs args) {
        String basis = args.requiredChoice("basis", PAIR_BASES);
        ReportPairService.ReportPair pair = reportPairService.findPair(corpCode(analysisId, args),
                ComparisonBasis.valueOf(basis), null);
        List<ToolLine> lines = new ArrayList<>();
        if (pair.current() != null) {
            lines.add(new ToolLine(reportEvidence(pair.current()), "[보고서 쌍 " + basis + ", 현재] "
                    + reportText(pair.current())));
        }
        if (pair.previous() != null) {
            lines.add(new ToolLine(reportEvidence(pair.previous()), "[보고서 쌍 " + basis + ", 이전] "
                    + reportText(pair.previous())));
        }
        if (pair.reason() != null) {
            lines.add(new ToolLine(null, "[보고서 쌍 " + basis + "] 고르지 못함: " + pair.reason().message()));
        }
        return lines;
    }

    /** 비교 가능성 검증. 결과(네 값과 comparable)를 함께 넘겨 분석 요청 확인 액션을 이 결과로만 허용한다 */
    private Output comparability(Long analysisId, ToolArgs args) {
        String corpCode = corpCode(analysisId, args);
        String previous = rceptNo(args, "previousRceptNo");
        String current = rceptNo(args, "currentRceptNo");
        String basis = args.requiredChoice("basis", AgentActions.BASES);
        ComparabilityService.ComparabilityResult result = comparabilityService.check(corpCode, current, previous,
                ComparisonBasis.valueOf(basis));
        String head = result.comparable()
                ? "[비교 가능성] 비교할 수 있음(" + result.level() + ", " + result.fsDiv() + ")"
                : "[비교 가능성] 비교할 수 없음: " + result.reasons().stream()
                        .map(ComparabilityService.Reason::message).toList();
        List<ToolLine> lines = List.of(
                new ToolLine(reportEvidence(result.current()), head + " 현재 " + reportText(result.current())),
                new ToolLine(reportEvidence(result.previous()), "[비교 가능성] 이전 " + reportText(result.previous())));
        return new Output(lines, null, new ComparabilityCheck(corpCode, previous, current, basis,
                result.comparable()));
    }

    private static String rceptNo(ToolArgs args, String name) {
        String value = args.string(name);
        if (value == null || !RCEPT_NO.matcher(value).matches()) {
            throw new IllegalArgumentException(name + "는 14자리 접수번호여야 합니다.");
        }
        return value;
    }

    /** 정기보고서 근거(D{접수번호}, ADR-0048의 공시 근거) */
    private static Evidence reportEvidence(Report report) {
        String rceptDt = report.getRceptDt() == null ? null : report.getRceptDt().toString();
        return Evidence.disclosure(report.getRceptNo(), report.getReportName(), rceptDt,
                DartLinks.viewer(report.getRceptNo()));
    }

    private static String reportText(Report report) {
        return report.getReportName() + "(접수번호 " + report.getRceptNo() + ")";
    }

    /** 이 분석의 두 보고서 중 하나면 그 쪽(원문 확인 탭에서 열 수 있음), 아니면 null */
    private static String side(Analysis analysis, String rceptNo) {
        if (rceptNo == null) {
            return null;
        }
        return rceptNo.equals(analysis.getCurrentRceptNo()) ? "current"
                : rceptNo.equals(analysis.getPreviousRceptNo()) ? "previous" : null;
    }

    private String corpCode(Long analysisId, ToolArgs args) {
        return corpCode(analysisResultService.get(analysisId), args);
    }

    /** 인자의 고유번호(없으면 이 분석의 기업). 기업 목록에 없으면 실행하지 않는다 */
    private String corpCode(Analysis analysis, ToolArgs args) {
        String corpCode = args.string(CORP);
        if (corpCode == null) {
            return analysis.getCorpCode();
        }
        if (!CORP_CODE.matcher(corpCode).matches() || companyService.find(corpCode).isEmpty()) {
            throw new IllegalArgumentException("없는 기업입니다: " + corpCode);
        }
        return corpCode;
    }
}
