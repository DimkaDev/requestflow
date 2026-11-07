package dev.flowtrace.client;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.List;

/**
 * Persistent TCP transport with automatic reconnect and initial `hello` handshake.
 */
public final class TcpTransport implements Transport {

    private final String host;
    private final int port;
    private final String apiKey;
    private final boolean ack;
    private Socket socket;
    private OutputStream out;
    private BufferedReader in;

    public TcpTransport(String host, int port, String apiKey, boolean ack) {
        this.host = host;
        this.port = port;
        this.apiKey = apiKey != null ? apiKey : "";
        this.ack = ack;
    }

    private synchronized boolean ensureConnected() {
        if (socket != null && socket.isConnected() && !socket.isClosed()) {
            return true;
        }
        closeQuietly();
        try {
            socket = new Socket();
            socket.setTcpNoDelay(true);
            socket.setSoTimeout(3000);
            socket.connect(new InetSocketAddress(host, port), 3000);
            out = socket.getOutputStream();
            in = new BufferedReader(new InputStreamReader(socket.getInputStream(), StandardCharsets.UTF_8));

            String hello = "{\"type\":\"hello\",\"key\":\"" + apiKey + "\",\"ack\":" + ack + "}\n";
            out.write(hello.getBytes(StandardCharsets.UTF_8));
            out.flush();
            String reply = in.readLine();
            if (reply == null || !reply.contains("hello_ok")) {
                closeQuietly();
                return false;
            }
            return true;
        } catch (Exception e) {
            closeQuietly();
            return false;
        }
    }

    @Override
    public synchronized void sendBatch(List<ClientEvent> events) {
        if (events == null || events.isEmpty()) {
            return;
        }
        if (!ensureConnected()) {
            return;
        }
        try {
            StringBuilder sb = new StringBuilder();
            for (ClientEvent ev : events) {
                sb.append(ev.toJson(false)).append('\n');
            }
            out.write(sb.toString().getBytes(StandardCharsets.UTF_8));
            out.flush();
            if (ack) {
                for (int i = 0; i < events.size(); i++) {
                    in.readLine();
                }
            }
        } catch (Exception e) {
            closeQuietly();
        }
    }

    private void closeQuietly() {
        try {
            if (socket != null) socket.close();
        } catch (Exception ignored) {
        }
        socket = null;
        out = null;
        in = null;
    }

    @Override
    public synchronized void close() {
        closeQuietly();
    }
}
