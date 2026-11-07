package dev.flowtrace.client;

import java.util.List;

/**
 * Transport abstraction for FlowTrace Java SDK (`HttpTransport`, `UdpTransport`, `TcpTransport`).
 */
public interface Transport extends AutoCloseable {

    void sendBatch(List<ClientEvent> events);

    @Override
    void close();
}
