package dev.flowtrace.client;

import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;

public final class UdpTransport implements Transport {

    private final InetSocketAddress targetAddress;
    private final DatagramSocket socket;

    public UdpTransport(String host, int port) {
        try {
            this.targetAddress = new InetSocketAddress(host, port);
            this.socket = new DatagramSocket();
        } catch (Exception e) {
            throw new IllegalArgumentException("Failed to initialize UDP transport for " + host + ":" + port, e);
        }
    }

    @Override
    public void sendBatch(List<ClientEvent> events) {
        if (events == null || events.isEmpty() || socket.isClosed()) {
            return;
        }
        for (ClientEvent ev : events) {
            try {
                byte[] bytes = ev.toJson(true).getBytes(StandardCharsets.UTF_8);
                if (bytes.length <= 1200) {
                    DatagramPacket packet = new DatagramPacket(bytes, bytes.length, targetAddress);
                    socket.send(packet);
                }
            } catch (Exception ignored) {
                // Never throw into host app
            }
        }
    }

    @Override
    public void close() {
        try {
            socket.close();
        } catch (Exception ignored) {
        }
    }
}
