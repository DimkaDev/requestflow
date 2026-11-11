package dev.flowtrace.domain;

/**
 * Identifiable customer/visitor entity persona attached to an event (spec v1.1).
 */
public record EntityInfo(
        String kind,
        String ref,
        String label,
        String avatar
) {
    public static final int MAX_KIND_LENGTH = 32;
    public static final int MAX_REF_LENGTH = 128;
    public static final int MAX_LABEL_LENGTH = 40;
    public static final int MAX_AVATAR_LENGTH = 32;

    public EntityInfo {
        if (kind != null && kind.length() > MAX_KIND_LENGTH) {
            throw new ValidationException("entity.kind exceeds max length of " + MAX_KIND_LENGTH);
        }
        if (ref != null && ref.length() > MAX_REF_LENGTH) {
            throw new ValidationException("entity.ref exceeds max length of " + MAX_REF_LENGTH);
        }
        if (label != null && label.length() > MAX_LABEL_LENGTH) {
            throw new ValidationException("entity.label exceeds max length of " + MAX_LABEL_LENGTH);
        }
        if (avatar != null && avatar.length() > MAX_AVATAR_LENGTH) {
            throw new ValidationException("entity.avatar exceeds max length of " + MAX_AVATAR_LENGTH);
        }
    }
}
