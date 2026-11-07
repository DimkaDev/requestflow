package dev.flowtrace.client;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;

/**
 * FlowTrace Java SDK entry point (spec section 12).
 * Never blocks and never throws into the host application.
 */
public final class FlowTrace implements AutoCloseable {

    private final String apiKey;
    private final Transport transport;
    private final ArrayBlockingQueue<ClientEvent> queue;
    private final ScheduledExecutorService worker;
    private final AtomicLong seqCounter = new AtomicLong(1);
    private final AtomicLong droppedCounter = new AtomicLong(0);
    private final AtomicBoolean closed = new AtomicBoolean(false);

    private FlowTrace(String apiKey, Transport transport, int queueCapacity) {
        this.apiKey = apiKey != null ? apiKey : "";
        this.transport = transport;
        this.queue = new ArrayBlockingQueue<>(Math.max(64, queueCapacity));
        this.worker = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "flowtrace-sdk-sender");
            t.setDaemon(true);
            return t;
        });
        this.worker.scheduleWithFixedDelay(this::flushQueue, 50, 50, TimeUnit.MILLISECONDS);
    }

    public static Builder builder() {
        return new Builder();
    }

    /**
     * Generates a new UUIDv7 trace ID locally without any network call.
     */
    public String newTrace() {
        return UuidV7Generator.nextUuid();
    }

    public void checkpoint(String node) {
        String traceId = FlowTraceContext.currentTraceId();
        if (traceId != null) {
            enqueue(traceId, node, null, "enter", FlowTraceContext.currentBranch(), null, null);
        }
    }

    public void checkpoint(String traceId, String node) {
        enqueue(traceId, node, null, "enter", "main", null, null);
    }

    public void checkpoint(String traceId, String node, Map<String, Object> attrs) {
        enqueue(traceId, node, null, "enter", "main", null, attrs);
    }

    public void checkpoint(String traceId, String node, String from, String label, Map<String, Object> attrs) {
        enqueue(traceId, node, from, "enter", "main", label, attrs);
    }

    public void error(String traceId, String node, String label) {
        enqueue(traceId, node, null, "error", "main", label, null);
    }

    public void end(String traceId) {
        enqueue(traceId, "end", null, "end", "main", null, null);
    }

    public void end(String traceId, String node) {
        enqueue(traceId, node, null, "end", "main", null, null);
    }

    public long droppedEventsCount() {
        return droppedCounter.get();
    }

    private void enqueue(
            String traceId,
            String node,
            String from,
            String type,
            String branch,
            String label,
            Map<String, Object> attrs
    ) {
        if (closed.get() || traceId == null || node == null) {
            return;
        }
        try {
            ClientEvent ev = new ClientEvent(
                    1,
                    apiKey,
                    traceId,
                    node,
                    from,
                    type,
                    branch != null ? branch : "main",
                    System.currentTimeMillis(),
                    label,
                    attrs,
                    seqCounter.getAndIncrement()
            );
            if (!queue.offer(ev)) {
                droppedCounter.incrementAndGet();
            }
        } catch (Exception ignored) {
            // Never throw into host app
        }
    }

    public void flushNow() {
        flushQueue();
    }

    private void flushQueue() {
        if (queue.isEmpty()) {
            return;
        }
        List<ClientEvent> batch = new ArrayList<>(64);
        while (!queue.isEmpty()) {
            batch.clear();
            queue.drainTo(batch, 64);
            if (batch.isEmpty()) {
                break;
            }
            try {
                transport.sendBatch(batch);
            } catch (Exception ignored) {
            }
        }
    }

    @Override
    public void close() {
        if (closed.compareAndSet(false, true)) {
            worker.shutdown();
            try {
                flushQueue();
                worker.awaitTermination(2, TimeUnit.SECONDS);
            } catch (InterruptedException ignored) {
                Thread.currentThread().interrupt();
            } finally {
                try {
                    transport.close();
                } catch (Exception ignored) {
                }
            }
        }
    }

    public static final class Builder {
        private String endpoint = "http://localhost:8080/api/v1";
        private String apiKey = "";
        private int queueCapacity = 4096;
        private boolean tcpAck = false;
        private Transport customTransport;

        public Builder endpoint(String endpoint) {
            if (endpoint != null && !endpoint.isBlank()) {
                this.endpoint = endpoint.trim();
            }
            return this;
        }

        public Builder apiKey(String apiKey) {
            this.apiKey = apiKey != null ? apiKey.trim() : "";
            return this;
        }

        public Builder queueCapacity(int queueCapacity) {
            this.queueCapacity = queueCapacity;
            return this;
        }

        public Builder tcpAck(boolean tcpAck) {
            this.tcpAck = tcpAck;
            return this;
        }

        public Builder transport(Transport customTransport) {
            this.customTransport = customTransport;
            return this;
        }

        public FlowTrace build() {
            Transport resolved = customTransport;
            if (resolved == null) {
                URI uri = URI.create(endpoint);
                String scheme = uri.getScheme() != null ? uri.getScheme().toLowerCase() : "http";
                resolved = switch (scheme) {
                    case "udp" -> new UdpTransport(
                            uri.getHost() != null ? uri.getHost() : "localhost",
                            uri.getPort() > 0 ? uri.getPort() : 9001
                    );
                    case "tcp" -> new TcpTransport(
                            uri.getHost() != null ? uri.getHost() : "localhost",
                            uri.getPort() > 0 ? uri.getPort() : 9000,
                            apiKey,
                            tcpAck
                    );
                    default -> new HttpTransport(endpoint, apiKey);
                };
            }
            return new FlowTrace(apiKey, resolved, queueCapacity);
        }
    }
}
