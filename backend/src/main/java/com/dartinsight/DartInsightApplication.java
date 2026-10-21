package com.dartinsight;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class DartInsightApplication {

    public static void main(String[] args) {
        SpringApplication.run(DartInsightApplication.class, args);
    }
}
