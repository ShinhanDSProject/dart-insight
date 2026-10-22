package com.dartinsight.support;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.stream.Stream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/** 원문 테스트 도우미. 원문 캐시 폴더는 application-test.yml의 app.document.cache-dir와 같다. */
public final class TestDocuments {

    public static final Path CACHE = Path.of("build/test-document-cache");

    private TestDocuments() {
    }

    /** 테스트마다 원문 캐시를 비운다(앞 테스트가 받은 ZIP을 쓰지 않도록). */
    public static void clearCache() {
        if (!Files.exists(CACHE)) {
            return;
        }
        try (Stream<Path> files = Files.walk(CACHE)) {
            files.sorted(Comparator.reverseOrder()).forEach(p -> p.toFile().delete());
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    /** 본문 파일 하나가 든 ZIP. 내용은 가짜 AI 서버가 구조화 결과를 정하므로 중요하지 않다. */
    public static byte[] zip(String rceptNo) {
        try (ByteArrayOutputStream bytes = new ByteArrayOutputStream();
                ZipOutputStream out = new ZipOutputStream(bytes)) {
            out.putNextEntry(new ZipEntry(rceptNo + ".xml"));
            out.write("<DOCUMENT/>".getBytes(StandardCharsets.UTF_8));
            out.closeEntry();
            out.finish();
            return bytes.toByteArray();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
