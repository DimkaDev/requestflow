package dev.flowtrace.client;

import java.util.Map;

/**
 * Immutable checkpoint payload for the FlowTrace Java SDK.
 */
public record ClientEvent(
        int v,
        String key,
        String traceId,
        String node,
        String from,
        String type,
        String branch,
        long ts,
        String label,
        Map<String, Object> attrs,
        long seq
) {
    public String toJson(boolean includeKey) {
        StringBuilder sb = new StringBuilder(160);
        sb.append("{\"v\":").append(v);
        if (includeKey && key != null && !key.isEmpty()) {
            sb.append(",\"key\":\"").append(escape(key)).append('"');
        }
        sb.append(",\"traceId\":\"").append(escape(traceId)).append('"');
        sb.append(",\"node\":\"").append(escape(node)).append('"');
        if (from != null && !from.isEmpty()) {
            sb.append(",\"from\":\"").append(escape(from)).append('"');
        }
        if (type != null && !type.isEmpty()) {
            sb.append(",\"type\":\"").append(escape(type)).append('"');
        }
        if (branch != null && !branch.isEmpty()) {
            sb.append(",\"branch\":\"").append(escape(branch)).append('"');
        }
        sb.append(",\"ts\":").append(ts);
        if (label != null && !label.isEmpty()) {
            sb.append(",\"label\":\"").append(escape(label)).append('"');
        }
        if (attrs != null && !attrs.isEmpty()) {
            sb.append(",\"attrs\":{");
            boolean first = true;
            for (var entry : attrs.entrySet()) {
                if (entry.getKey() == null || entry.getValue() == null) continue;
                if (!first) sb.append(',');
                first = false;
                sb.append('"').append(escape(entry.getKey())).append("\":");
                Object val = entry.getValue();
                if (val instanceof Number || val instanceof Boolean) {
                    sb.append(val);
                } else {
                    sb.append('"').append(escape(String.valueOf(val))).append('"');
                }
            }
            sb.append('}');
        }
        sb.append(",\"seq\":").append(seq);
        sb.append('}');
        return sb.toString();
    }

    private static String escape(String s) {
        if (s == null) return "";
        StringBuilder out = new StringBuilder(s.length());
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"' -> out.append("\\\"");
                case '\\' -> out.append("\\\\");
                case '\n' -> out.append("\\n");
                case '\r' -> out.append("\\r");
                case '\t' -> out.append("\\t");
                default -> out.append(c);
            }
        }
        return out.toString();
    }
}
