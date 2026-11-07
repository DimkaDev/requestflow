package dev.flowtrace.client;

import java.nio.ByteBuffer;
import java.security.SecureRandom;
import java.util.UUID;

/**
 * RFC 9562 time-ordered UUIDv7 generator for FlowTrace Java SDK.
 */
public final class UuidV7Generator {

    private static final SecureRandom RANDOM = new SecureRandom();

    private UuidV7Generator() {
    }

    public static String nextUuid() {
        long epochMillis = System.currentTimeMillis();
        byte[] randomBytes = new byte[10];
        RANDOM.nextBytes(randomBytes);

        long msb = (epochMillis & 0xFFFFFFFFFFFFL) << 16;
        msb |= 0x7000L;
        msb |= ((randomBytes[0] & 0x0FL) << 8) | (randomBytes[1] & 0xFFL);

        ByteBuffer buf = ByteBuffer.wrap(randomBytes, 2, 8);
        long lsb = buf.getLong();
        lsb = (lsb & 0x3FFFFFFFFFFFFFFFL) | 0x8000000000000000L;

        return new UUID(msb, lsb).toString();
    }
}
