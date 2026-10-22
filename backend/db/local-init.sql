-- 로컬 개발용 DB와 계정을 만든다. MariaDB를 설치한 뒤 한 번만 실행한다.
-- 실행 방법은 docs/local-setup.md 2장. 여러 번 실행해도 안전하다.
-- 계정·비밀번호는 backend/.env.example과 같은 로컬 전용 값이다. 실제 서버에서는 쓰지 않는다.
-- 테이블은 만들지 않는다. backend를 실행하면 Flyway가 db/migration의 파일로 만든다.

CREATE DATABASE IF NOT EXISTS dart_insight
    DEFAULT CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

-- JDBC가 localhost로 붙을 때 IPv4·IPv6 어느 쪽으로든 들어올 수 있어 세 가지를 모두 만든다
CREATE USER IF NOT EXISTS 'dart'@'localhost' IDENTIFIED BY 'change-me';
CREATE USER IF NOT EXISTS 'dart'@'127.0.0.1' IDENTIFIED BY 'change-me';
CREATE USER IF NOT EXISTS 'dart'@'::1' IDENTIFIED BY 'change-me';

GRANT ALL PRIVILEGES ON dart_insight.* TO 'dart'@'localhost';
GRANT ALL PRIVILEGES ON dart_insight.* TO 'dart'@'127.0.0.1';
GRANT ALL PRIVILEGES ON dart_insight.* TO 'dart'@'::1';
