package dev.flowtrace.domain;

/**
 * Single item carried by a customer entity (spec v1.1).
 */
public record CarryItem(
        String sku,
        String label,
        String icon,
        String image,
        int qty,
        double price,
        String currency
) {
    public static final int MAX_SKU_LENGTH = 64;
    public static final int MAX_LABEL_LENGTH = 60;
    public static final int MAX_ICON_LENGTH = 200;
    public static final int MAX_IMAGE_LENGTH = 512;
    public static final int MAX_CURRENCY_LENGTH = 8;

    public CarryItem {
        if (sku == null || sku.isBlank() || sku.length() > MAX_SKU_LENGTH) {
            throw new ValidationException("carry item sku is required and must be 1.." + MAX_SKU_LENGTH + " chars");
        }
        if (label != null && label.length() > MAX_LABEL_LENGTH) {
            throw new ValidationException("carry item label exceeds " + MAX_LABEL_LENGTH + " chars");
        }
        if (icon != null && icon.length() > MAX_ICON_LENGTH) {
            throw new ValidationException("carry item icon exceeds " + MAX_ICON_LENGTH + " chars");
        }
        if (image != null && image.length() > MAX_IMAGE_LENGTH) {
            throw new ValidationException("carry item image exceeds " + MAX_IMAGE_LENGTH + " chars");
        }
        if (currency != null && currency.length() > MAX_CURRENCY_LENGTH) {
            throw new ValidationException("carry item currency exceeds " + MAX_CURRENCY_LENGTH + " chars");
        }
        if (qty < 0) {
            throw new ValidationException("carry item qty cannot be negative");
        }
        if (price < 0.0) {
            throw new ValidationException("carry item price cannot be negative");
        }
    }

    public CarryItem withQty(int newQty) {
        return new CarryItem(sku, label, icon, image, newQty, price, currency);
    }
}
