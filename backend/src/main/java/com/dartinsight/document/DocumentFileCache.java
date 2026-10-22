package com.dartinsight.document;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Optional;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/** 받은 원문 ZIP을 접수번호 이름으로 디스크에 둔다. 파서를 바꿔 다시 읽을 때 OpenDART를 다시 부르지 않는다. */
@Component
public class DocumentFileCache {

    private static final Logger log = LoggerFactory.getLogger(DocumentFileCache.class);
    private static final Pattern RCEPT_NO = Pattern.compile("\\d{14}");

    private final Path dir;

    public DocumentFileCache(DocumentProperties properties) {
        this.dir = Path.of(properties.cacheDir());
    }

    public Optional<byte[]> read(String rceptNo) {
        Path file = file(rceptNo);
        if (!Files.isRegularFile(file)) {
            return Optional.empty();
        }
        try {
            byte[] data = Files.readAllBytes(file);
            if (data.length < 4 || data[0] != 'P' || data[1] != 'K') {
                log.warn("원문 캐시가 ZIP이 아니어서 지웁니다: {}", file);
                Files.deleteIfExists(file);
                return Optional.empty();
            }
            return Optional.of(data);
        } catch (IOException e) {
            log.warn("원문 캐시를 읽지 못했습니다: {}", file, e);
            return Optional.empty();
        }
    }

    public void write(String rceptNo, byte[] zip) {
        Path file = file(rceptNo);
        try {
            Files.createDirectories(dir);
            Path temp = Files.createTempFile(dir, rceptNo, ".part");
            Files.write(temp, zip);
            Files.move(temp, file, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        } catch (IOException e) {
            throw new UncheckedIOException("원문 캐시를 저장하지 못했습니다: " + file, e);
        }
    }

    private Path file(String rceptNo) {
        if (!RCEPT_NO.matcher(rceptNo).matches()) {
            throw new IllegalArgumentException("접수번호 형식이 아닙니다: " + rceptNo);
        }
        return dir.resolve(rceptNo + ".zip");
    }
}
