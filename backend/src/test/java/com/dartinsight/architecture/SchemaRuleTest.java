package com.dartinsight.architecture;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.util.ArrayList;
import java.util.List;
import javax.sql.DataSource;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

/**
 * 스키마 규칙(conventions.yaml EN-5, ADR-0017). Flyway가 만든 실제 스키마를 읽어 검사하므로 H2·MariaDB 모두에서 돈다.
 * 모든 테이블의 기본키는 자동 증가 BIGINT 컬럼 id 하나다. OpenDART 값(고유번호·접수번호 등)은 UNIQUE로 둔다.
 */
@SpringBootTest
class SchemaRuleTest {

    private static final String FLYWAY_HISTORY = "flyway_schema_history";

    @Autowired
    private DataSource dataSource;

    @Test
    @DisplayName("모든 테이블의 기본키는 자동 증가 BIGINT id다")
    void everyTableHasAutoIncrementIdPrimaryKey() throws SQLException {
        List<String> violations = new ArrayList<>();
        try (Connection connection = dataSource.getConnection()) {
            DatabaseMetaData meta = connection.getMetaData();
            String catalog = connection.getCatalog();
            String schema = connection.getSchema();
            List<String> tables = tables(meta, catalog, schema);
            assertThat(tables).contains("company", "report", "analysis");
            for (String table : tables) {
                List<String> primaryKey = primaryKey(meta, catalog, schema, table);
                if (!primaryKey.equals(List.of("id"))) {
                    violations.add(table + ": 기본키가 " + primaryKey);
                } else if (!isAutoIncrementBigint(meta, catalog, schema, table)) {
                    violations.add(table + ": id가 자동 증가 BIGINT가 아님");
                }
            }
        }
        assertThat(violations).isEmpty();
    }

    private static List<String> tables(DatabaseMetaData meta, String catalog, String schema) throws SQLException {
        List<String> tables = new ArrayList<>();
        try (ResultSet rs = meta.getTables(catalog, schema, "%", new String[] {"TABLE"})) {
            while (rs.next()) {
                String name = rs.getString("TABLE_NAME").toLowerCase();
                if (!name.equals(FLYWAY_HISTORY)) {
                    tables.add(name);
                }
            }
        }
        return tables;
    }

    private static List<String> primaryKey(DatabaseMetaData meta, String catalog, String schema, String table)
            throws SQLException {
        List<String> columns = new ArrayList<>();
        try (ResultSet rs = meta.getPrimaryKeys(catalog, schema, table)) {
            while (rs.next()) {
                columns.add(rs.getString("COLUMN_NAME").toLowerCase());
            }
        }
        return columns;
    }

    private static boolean isAutoIncrementBigint(DatabaseMetaData meta, String catalog, String schema, String table)
            throws SQLException {
        try (ResultSet rs = meta.getColumns(catalog, schema, table, "id")) {
            return rs.next() && rs.getInt("DATA_TYPE") == Types.BIGINT
                    && "YES".equals(rs.getString("IS_AUTOINCREMENT"));
        }
    }
}
