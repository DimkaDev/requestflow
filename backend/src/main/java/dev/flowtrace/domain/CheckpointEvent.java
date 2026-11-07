package dev.flowtrace.domain;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Validated Checkpoint / Event domain model (spec section 6).
 */
public record CheckpointEvent(
        int v,
        String key,
        String traceId,
        String node,
        String from,
        EventType type,
        String branch,
        Long clientTs,
        long serverTs,
        String label,
        Map<String, Object> attrs,
        Long seq
) {
    public static final Pattern NODE_KEY_PATTERN = Pattern.compile("^[a-z0-9-_.]{1,64}$");
    public static final int MAX_LABEL_LENGTH = 40;
    public static final int MAX_ATTR_KEYS = 10;
    public static final int MAX_ATTR_VALUE_LENGTH = 100;
    public static final int MAX_BRANCH_LENGTH = 64;

    public static CheckpointEvent validateAndCreate(
            Integer v,
            String key,
            String traceId,
            String node,
            String from,
            String typeStr,
            String branch,
            Long clientTs,
            long serverTs,
            String label,
            Map<String, Object> rawAttrs,
            Long seq
    ) {
        int version = (v == null) ? 1 : v;
        if (version != 1) {
            throw new ValidationException("Unsupported schema version: " + version);
        }
        if (!UuidV7.isValidUuid(traceId)) {
            throw new ValidationException("traceId must be a valid UUID");
        }
        if (node == null || !NODE_KEY_PATTERN.matcher(node).matches()) {
            throw new ValidationException("node must match [a-z0-9-_.]{1,64}");
        }
        if (from != null && !from.isBlank()) {
            if (!NODE_KEY_PATTERN.matcher(from).matches()) {
                throw new ValidationException("from must match [a-z0-9-_.]{1,64}");
            }
        } else {
            from = null;
        }

        EventType eventType;
        try {
            eventType = EventType.fromString(typeStr);
        } catch (IllegalArgumentException e) {
            throw new ValidationException(e.getMessage());
        }

        String normalizedBranch = (branch == null || branch.isBlank()) ? "main" : branch.trim();
        if (normalizedBranch.length() > MAX_BRANCH_LENGTH) {
            throw new ValidationException("branch exceeds max length of " + MAX_BRANCH_LENGTH);
        }

        if (label != null && label.length() > MAX_LABEL_LENGTH) {
            throw new ValidationException("label exceeds max length of " + MAX_LABEL_LENGTH);
        }

        Map<String, Object> cleanAttrs = Collections.emptyMap();
        if (rawAttrs != null && !rawAttrs.isEmpty()) {
            if (rawAttrs.size() > MAX_ATTR_KEYS) {
                throw new ValidationException("attrs cannot have more than " + MAX_ATTR_KEYS + " keys");
            }
            Map<String, Object> copy = new LinkedHashMap<>();
            for (Map.Entry<String, Object> entry : rawAttrs.entrySet()) {
                String k = entry.getKey();
                Object val = entry.getValue();
                if (k == null || k.isBlank() || k.length() > 64) {
                    throw new ValidationException("attr key must be 1..64 chars");
                }
                if (val == null) {
                    continue;
                }
                if (val instanceof String s) {
                    if (s.length() > MAX_ATTR_VALUE_LENGTH) {
                        throw new ValidationException("attr value for '" + k + "' exceeds " + MAX_ATTR_VALUE_LENGTH + " chars");
                    }
                    copy.put(k, s);
                } else if (val instanceof Number || val instanceof Boolean) {
                    copy.put(k, val);
                } else {
                    throw new ValidationException("attr value for '" + k + "' must be string, number, or boolean");
                }
            }
            cleanAttrs = Collections.unmodifiableMap(copy);
        }

        return new CheckpointEvent(
                version,
                key,
                traceId.toLowerCase(),
                node,
                from,
                eventType,
                normalizedBranch,
                clientTs,
                serverTs,
                label,
                cleanAttrs,
                seq
        );
    }
}
