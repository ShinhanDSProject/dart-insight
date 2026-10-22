package com.dartinsight.document;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * 원문 설정. application.yml의 app.document.*
 *
 * @param cacheDir 받은 원문 ZIP을 접수번호별로 두는 폴더. 같은 원문을 OpenDART에서 다시 받지 않는다
 */
@ConfigurationProperties(prefix = "app.document")
public record DocumentProperties(@DefaultValue("./data/documents") String cacheDir) {
}
