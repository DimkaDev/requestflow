package dev.flowtrace.client;

/**
 * ThreadLocal context helper so `ft.checkpoint("node")` works without passing `traceId` around (spec section 12).
 */
public final class FlowTraceContext {

    private static final ThreadLocal<String> CURRENT_TRACE_ID = new ThreadLocal<>();
    private static final ThreadLocal<String> CURRENT_BRANCH = ThreadLocal.withInitial(() -> "main");

    private FlowTraceContext() {
    }

    public static Scope withTrace(String traceId) {
        return withTrace(traceId, "main");
    }

    public static Scope withTrace(String traceId, String branch) {
        String prevTrace = CURRENT_TRACE_ID.get();
        String prevBranch = CURRENT_BRANCH.get();
        CURRENT_TRACE_ID.set(traceId);
        CURRENT_BRANCH.set(branch != null ? branch : "main");
        return () -> {
            if (prevTrace == null) {
                CURRENT_TRACE_ID.remove();
            } else {
                CURRENT_TRACE_ID.set(prevTrace);
            }
            CURRENT_BRANCH.set(prevBranch != null ? prevBranch : "main");
        };
    }

    public static String currentTraceId() {
        return CURRENT_TRACE_ID.get();
    }

    public static String currentBranch() {
        return CURRENT_BRANCH.get();
    }

    public static void clear() {
        CURRENT_TRACE_ID.remove();
        CURRENT_BRANCH.remove();
    }

    public interface Scope extends AutoCloseable {
        @Override
        void close();
    }
}
