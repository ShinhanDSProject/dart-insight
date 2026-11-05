package com.dartinsight.textevent.repository;

import com.dartinsight.textevent.domain.TextEvent;
import com.dartinsight.textevent.domain.TextEventRow;
import com.dartinsight.textevent.domain.TextEventRow.Quote;
import java.sql.Date;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Repository;

/** 주요 사건 저장(text_event, text_event_change, text_event_quote, text_event_unbound_change). 변경 연결이 많아 JDBC로 저장한다. */
@Repository
@RequiredArgsConstructor
public class TextEventStore {

    private static final int BATCH = 500;
    private static final String COLUMNS = "id, sort_order, title, kind, scale_amount, scale_amount_text, currency, "
            + "scale_amount_krw, scale_ratio, scale_not_computed_reason, scale_evidence_id, amount_source, fx_source, "
            + "fx_rate_date, sort_basis, model, prompt_version, generated_at";

    private final JdbcTemplate jdbcTemplate;

    /** 트랜잭션 안에서 부른다. */
    public void saveAll(long runId, List<TextEventRow> events, List<Integer> unboundChangeNos) {
        List<Object[]> changes = new ArrayList<>();
        List<Object[]> quotes = new ArrayList<>();
        for (TextEventRow event : events) {
            long eventId = insert(runId, event);
            event.changeNos().forEach(changeNo -> changes.add(new Object[] {eventId, changeNo}));
            int quoteNo = 1;
            for (Quote quote : event.quotes()) {
                quotes.add(new Object[] {eventId, quoteNo++, quote.changeNo(), quote.purpose(), quote.side(),
                        quote.rceptNo(), quote.sectionNo(), quote.blockNo(), quote.text()});
            }
        }
        batch("INSERT INTO text_event_change (event_id, change_no) VALUES (?, ?)", changes);
        batch("INSERT INTO text_event_quote (event_id, quote_no, change_no, purpose, side, rcept_no, section_no, "
                + "block_no, quote_text) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", quotes);
        batch("INSERT INTO text_event_unbound_change (run_id, change_no) VALUES (?, ?)",
                unboundChangeNos.stream().map(changeNo -> new Object[] {runId, changeNo}).toList());
    }

    private long insert(long runId, TextEventRow event) {
        GeneratedKeyHolder keys = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement statement = connection.prepareStatement("INSERT INTO text_event (run_id, sort_order, "
                    + "title, kind, scale_amount, scale_amount_text, currency, scale_amount_krw, scale_ratio, "
                    + "scale_not_computed_reason, scale_evidence_id, amount_source, fx_source, fx_rate_date, "
                    + "sort_basis, model, prompt_version, generated_at) "
                    + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    Statement.RETURN_GENERATED_KEYS);
            statement.setLong(1, runId);
            statement.setInt(2, event.sortOrder());
            statement.setString(3, event.title());
            statement.setString(4, event.kind());
            statement.setObject(5, event.scaleAmount());
            statement.setString(6, event.scaleAmountText());
            statement.setString(7, event.currency());
            statement.setObject(8, event.scaleAmountKrw());
            statement.setBigDecimal(9, event.scaleRatio());
            statement.setString(10, event.scaleNotComputedReason());
            statement.setString(11, event.scaleEvidenceId());
            statement.setString(12, event.amountSource());
            statement.setString(13, event.fxSource());
            statement.setDate(14, event.fxRateDate() == null ? null : Date.valueOf(event.fxRateDate()));
            statement.setString(15, event.sortBasis());
            statement.setString(16, event.model());
            statement.setString(17, event.promptVersion());
            statement.setTimestamp(18, Timestamp.valueOf(event.generatedAt()));
            return statement;
        }, keys);
        return keys.getKey().longValue();
    }

    private void batch(String sql, List<Object[]> values) {
        for (int from = 0; from < values.size(); from += BATCH) {
            jdbcTemplate.batchUpdate(sql, values.subList(from, Math.min(values.size(), from + BATCH)));
        }
    }

    /** 실행의 사건 전부(sort_order 순) */
    public List<TextEvent> events(long runId) {
        return withDetails(jdbcTemplate.query("SELECT " + COLUMNS + " FROM text_event WHERE run_id = ? "
                + "ORDER BY sort_order", this::map, runId));
    }

    /** 실행의 사건 하나. 그 실행의 사건이 아니면 비어 있다 */
    public Optional<TextEvent> event(long runId, long eventId) {
        return withDetails(jdbcTemplate.query("SELECT " + COLUMNS + " FROM text_event WHERE run_id = ? AND id = ?",
                this::map, runId, eventId)).stream().findFirst();
    }

    /** 어느 사건에도 들어가지 않은 변경 번호(문서 순서) */
    public List<Integer> unboundChangeNos(long runId) {
        return jdbcTemplate.query("SELECT change_no FROM text_event_unbound_change WHERE run_id = ? ORDER BY change_no",
                (rs, i) -> rs.getInt("change_no"), runId);
    }

    private List<TextEvent> withDetails(List<TextEvent> events) {
        if (events.isEmpty()) {
            return List.of();
        }
        Map<Long, List<Integer>> changes = new LinkedHashMap<>();
        Map<Long, List<Quote>> quotes = new LinkedHashMap<>();
        events.forEach(event -> {
            changes.put(event.id(), new ArrayList<>());
            quotes.put(event.id(), new ArrayList<>());
        });
        Object[] ids = events.stream().map(TextEvent::id).toArray();
        String in = String.join(", ", Collections.nCopies(ids.length, "?"));
        jdbcTemplate.query("SELECT event_id, change_no FROM text_event_change WHERE event_id IN (" + in + ") "
                + "ORDER BY change_no", rs -> {
                    changes.get(rs.getLong("event_id")).add(rs.getInt("change_no"));
                }, ids);
        jdbcTemplate.query("SELECT event_id, change_no, purpose, side, rcept_no, section_no, block_no, quote_text "
                + "FROM text_event_quote WHERE event_id IN (" + in + ") ORDER BY quote_no", rs -> {
                    quotes.get(rs.getLong("event_id")).add(new Quote(rs.getInt("change_no"), rs.getString("purpose"),
                            rs.getString("side"), rs.getString("rcept_no"),
                            rs.getObject("section_no", Integer.class), rs.getInt("block_no"),
                            rs.getString("quote_text")));
                }, ids);
        return events.stream().map(event -> new TextEvent(event.id(),
                event.row().with(changes.get(event.id()), quotes.get(event.id())))).toList();
    }

    /** 변경 연결과 인용을 붙이기 전의 사건 */
    private TextEvent map(ResultSet rs, int rowNum) throws SQLException {
        Date fxRateDate = rs.getDate("fx_rate_date");
        return new TextEvent(rs.getLong("id"), new TextEventRow(rs.getInt("sort_order"), rs.getString("title"),
                rs.getString("kind"), rs.getObject("scale_amount", Long.class), rs.getString("scale_amount_text"),
                rs.getString("currency"), rs.getObject("scale_amount_krw", Long.class),
                rs.getBigDecimal("scale_ratio"), rs.getString("scale_not_computed_reason"),
                rs.getString("scale_evidence_id"), rs.getString("amount_source"), rs.getString("fx_source"),
                fxRateDate == null ? null : fxRateDate.toLocalDate(), rs.getString("sort_basis"),
                rs.getString("model"), rs.getString("prompt_version"),
                rs.getTimestamp("generated_at").toLocalDateTime(), List.of(), List.of()));
    }
}
