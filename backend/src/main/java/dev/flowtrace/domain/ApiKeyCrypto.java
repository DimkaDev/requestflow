package dev.flowtrace.domain;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.HexFormat;

/**
 * Pure domain utility for generating `ft_live_<32 url-safe chars>` keys and SHA-256 hashing (spec section 8).
 */
public final class ApiKeyCrypto {

    private static final String PREFIX = "ft_live_";
    private static final String INVITE_PREFIX = "ft_inv_";
    private static final String ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    private static final SecureRandom RANDOM = new SecureRandom();

    private ApiKeyCrypto() {
    }

    public record GeneratedKey(String fullKey, String keyPrefix, String keyHash) {
    }

    public static GeneratedKey generateNewKey() {
        return generateWithPrefix(PREFIX);
    }

    public static GeneratedKey generateInvitationToken() {
        return generateWithPrefix(INVITE_PREFIX);
    }

    private static GeneratedKey generateWithPrefix(String prefix) {
        StringBuilder sb = new StringBuilder(prefix.length() + 32);
        sb.append(prefix);
        for (int i = 0; i < 32; i++) {
            sb.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
        }
        String fullKey = sb.toString();
        return fromRawKey(fullKey);
    }

    public static GeneratedKey fromRawKey(String fullKey) {
        String prefix = fullKey.length() >= 14 ? fullKey.substring(0, 14) : fullKey;
        return new GeneratedKey(fullKey, prefix, sha256Hex(fullKey));
    }

    public static String sha256Hex(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }
}
