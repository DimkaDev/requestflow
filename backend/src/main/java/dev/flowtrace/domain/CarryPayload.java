package dev.flowtrace.domain;

import java.util.Collections;
import java.util.List;

/**
 * Mutation payload specifying an operation and a list of items to mutate in TraceState.
 */
public record CarryPayload(
        CarryOp op,
        List<CarryItem> items
) {
    public static final int MAX_ITEMS_PER_EVENT = 20;

    public CarryPayload {
        if (op == null) {
            throw new ValidationException("carry.op is required");
        }
        if (items == null) {
            items = Collections.emptyList();
        } else if (items.size() > MAX_ITEMS_PER_EVENT) {
            throw new ValidationException("carry.items cannot exceed " + MAX_ITEMS_PER_EVENT + " items per event");
        } else {
            items = List.copyOf(items);
        }
    }
}
