FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /workspace
COPY pom.xml .
COPY client-java/pom.xml client-java/pom.xml
COPY simulator/pom.xml simulator/pom.xml
COPY backend/pom.xml backend/pom.xml
COPY infra/pom.xml infra/pom.xml
COPY client-java/src client-java/src
COPY simulator/src simulator/src
COPY backend/src backend/src
COPY infra/src infra/src
RUN apk add --no-cache maven && mvn -B -pl backend -am package -DskipTests

FROM eclipse-temurin:21-jre-alpine
WORKDIR /work/
COPY --from=build /workspace/backend/target/quarkus-app/lib/ /work/lib/
COPY --from=build /workspace/backend/target/quarkus-app/*.jar /work/
COPY --from=build /workspace/backend/target/quarkus-app/app/ /work/app/
COPY --from=build /workspace/backend/target/quarkus-app/quarkus/ /work/quarkus/
EXPOSE 8080 9000 9001/udp
ENV JAVA_OPTS="-Dquarkus.http.host=0.0.0.0 -Djava.util.logging.manager=org.jboss.logmanager.LogManager"
ENTRYPOINT ["java", "-jar", "/work/quarkus-run.jar"]
