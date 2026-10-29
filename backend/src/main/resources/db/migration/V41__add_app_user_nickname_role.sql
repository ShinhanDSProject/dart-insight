-- 커뮤니티 닉네임과 관리자 역할(6.6 #459, ADR-0040). docs/erd.md와 같다.
-- 닉네임은 처음 글을 쓸 때 정하므로 NULL을 허용하고, UNIQUE는 NULL을 여럿 허용한다.
ALTER TABLE app_user ADD COLUMN nickname VARCHAR(12);
ALTER TABLE app_user ADD COLUMN role VARCHAR(10) NOT NULL DEFAULT 'USER';
ALTER TABLE app_user ADD CONSTRAINT uk_app_user_nickname UNIQUE (nickname);
