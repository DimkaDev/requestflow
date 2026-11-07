package dev.flowtrace.client;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;

public final class HttpTransport implements Transport {

    private final URI eventsUri;
    private final String apiKey;
    private final HttpClient httpClient;

    public HttpTransport(String baseEndpoint, String apiKey) {
        String normalized = baseEndpoint.endsWith("/") ? baseEndpoint.substring(0, baseEndpoint.length() - 1) : baseEndpoint;
        if (!normalized.endsWith("/events")) {
            normalized = normalized + "/events";
        }
        this.eventsUri = URI.create(normalized);
        this.apiKey = apiKey != null ? apiKey : "";
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(3))
                .build();
    }

    @Override
    public void sendBatch(List<ClientEvent> events) {
        if (events == null || events.isEmpty()) {
            return;
        }
        try {
            StringBuilder json = new StringBuilder();
            if (events.size() == 1) {
                json.append(events.getFirst().toJson(false));
            } else {
                json.append('[');
                for (int i = 0; i < events.size(); i++) {
                    if (i > 0) json.append(',');
                    json.append(events.get(i).toJson(false));
                }
                json.append(']');
            }

            HttpRequest req = HttpRequest.newBuilder(eventsUri)
                    .timeout(Duration.ofSeconds(3))
                    .header("Content-Type", "application/json")
                    .header("X-API-Key", apiKey)
                    .POST(HttpRequest.BodyPublishers.ofString(json.toString()))
                    .build();
            httpClient.send(req, HttpResponse.BodyHandlers.discarding());
        } catch (Exception ignored) {
            // Never throw into host app
        }
    }

    @Override
    public void close() {
    }
}
