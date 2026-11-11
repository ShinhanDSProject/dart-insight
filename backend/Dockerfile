FROM eclipse-temurin:21-jdk AS build
WORKDIR /src

# Gradle wrapper 및 빌드 스크립트 먼저 복사하여 의존성 레이어 캐시
COPY gradlew settings.gradle build.gradle ./
COPY gradle gradle
RUN chmod +x gradlew && ./gradlew --no-daemon dependencies || true

# 소스 복사 후 실행 JAR 빌드 (테스트는 CI 단계에서 검증)
COPY src src
RUN ./gradlew --no-daemon bootJar -x test \
    && cp build/libs/*[!plain].jar /app.jar

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-XX:+UseContainerSupport", "-jar", "app.jar"]

