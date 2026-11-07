package dev.flowtrace.domain;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for all 9 Hop Resolution rules in spec section 6.1,
 * plus rate limiter, key hashing, and event validation.
 */
class HopResolverTest {

    private static final UUID PROJECT_ID = UUID.fromString("0194f1c0-0000-7000-8000-000000000001");

    @Test
    void rule3_firstCheckpointWithoutFrom_spawnsTokenAtNode() {
        HopResolver resolver = new HopResolver(30_000L);
        DiagramGraph diagram = DiagramGraph.defaultSampleDiagram();
        String traceId = UuidV7.generateString();

        CheckpointEvent ev = CheckpointEvent.validateAndCreate(
                1, "ft_live_key", traceId, "website", null, "enter", "main", 1000L, 1000L, null, null, 1L);

        HopResolver.ResolutionResult res = resolver.resolve(PROJECT_ID, true, diagram, ev);
        assertFalse(res.duplicateIgnored());
        assertNull(res.resolvedFromNode());
        assertEquals(1, res.uiEvents().size());
        assertInstanceOf(UiEvent.SpawnEvent.class, res.uiEvents().getFirst());
        UiEvent.SpawnEvent spawn = (UiEvent.SpawnEvent) res.uiEvents().getFirst();
        assertEquals("website", spawn.node());
        assertEquals(traceId, spawn.traceId());
    }

    @Test
    void rule2_secondCheckpointWithoutFrom_resolvesHopFromTraceState() {
        HopResolver resolver = new HopResolver(30_000L);
        DiagramGraph diagram = DiagramGraph.defaultSampleDiagram();
        String traceId = UuidV7.generateString();

        resolver.resolve(PROJECT_ID, true, diagram,
                CheckpointEvent.validateAndCreate(1, null, traceId, "website", null, "enter", "main", null, 1000L, null, null, 1L));

        HopResolver.ResolutionResult hopRes = resolver.resolve(PROJECT_ID, true, diagram,
                CheckpointEvent.validateAndCreate(1, null, traceId, "lb", null, "enter", "main", null, 1100L, "route=A", null, 2L));

        assertEquals("website", hopRes.resolvedFromNode());
        assertEquals(1, hopRes.uiEvents().size());
        UiEvent.HopEvent hop = assertInstanceOf(UiEvent.HopEvent.class, hopRes.uiEvents().getFirst());
        assertEquals("website", hop.from());
        assertEquals("lb", hop.to());
        assertEquals("e1", hop.edgeId());
        assertFalse(hop.unmapped());
        assertEquals("ok", hop.status());
    }

    @Test
    void rule1_explicitFromOverridesTraceState() {
        HopResolver resolver = new HopResolver(30_000L);
        DiagramGraph diagram = DiagramGraph.defaultSampleDiagram();
        String traceId = UuidV7.generateString();

        resolver.resolve(PROJECT_ID, true, diagram,
                CheckpointEvent.validateAndCreate(1, null, traceId, "website", null, "enter", "main", null, 1000L, null, null, 1L));

        HopResolver.ResolutionResult hopRes = resolver.resolve(PROJECT_ID, true, diagram,
                CheckpointEvent.validateAndCreate(1, null, traceId, "service-a", "if-premium", "enter", "main", null, 1200L, "yes", null, 2L));

        assertEquals("if-premium", hopRes.resolvedFromNode());
        UiEvent.HopEvent hop = assertInstanceOf(UiEvent.HopEvent.class, hopRes.uiEvents().getFirst());
        assertEquals("if-premium", hop.from());
        assertEquals("service-a", hop.to());
        assertEquals("e3", hop.edgeId());
    }

    @Test
    void rule5And6_autoDiscoverTrue_createsDiscoveredNodeAndEdgeAndEmitsPatch() {
        HopResolver resolver = new HopResolver(30_000L);
        DiagramGraph diagram = DiagramGraph.defaultSampleDiagram();
        String traceId = UuidV7.generateString();

        HopResolver.ResolutionResult res = resolver.resolve(PROJECT_ID, true, diagram,
                CheckpointEvent.validateAndCreate(1, null, traceId, "new-microservice", "service-a", "enter", "main", null, 2000L, "auto", null, 10L));

        assertNotNull(res.updatedDiagram());
        assertTrue(res.updatedDiagram().findNode("new-microservice").isPresent());
        assertTrue(res.updatedDiagram().findNode("new-microservice").get().discovered());
        assertTrue(res.updatedDiagram().findEdge("service-a", "new-microservice").isPresent());

        assertEquals(2, res.uiEvents().size());
        assertInstanceOf(UiEvent.DiagramPatchEvent.class, res.uiEvents().get(0));
        UiEvent.HopEvent hop = assertInstanceOf(UiEvent.HopEvent.class, res.uiEvents().get(1));
        assertNotNull(hop.edgeId());
        assertFalse(hop.unmapped());
    }

    @Test
    void rule5_autoDiscoverFalse_emitsUnmappedHopWithoutModifyingDiagram() {
        HopResolver resolver = new HopResolver(30_000L);
        DiagramGraph diagram = DiagramGraph.defaultSampleDiagram();
        String traceId = UuidV7.generateString();

        HopResolver.ResolutionResult res = resolver.resolve(PROJECT_ID, false, diagram,
                CheckpointEvent.validateAndCreate(1, null, traceId, "db", "website", "enter", "main", null, 2000L, null, null, 11L));

        assertNull(res.updatedDiagram());
        assertEquals(1, res.uiEvents().size());
        UiEvent.HopEvent hop = assertInstanceOf(UiEvent.HopEvent.class, res.uiEvents().getFirst());
        assertNull(hop.edgeId());
        assertTrue(hop.unmapped());
    }

    @Test
    void rule7And8_errorAndEndEvents_setErrorStatusAndEmitEnd() {
        HopResolver resolver = new HopResolver(30_000L);
        DiagramGraph diagram = DiagramGraph.defaultSampleDiagram();
        String traceId = UuidV7.generateString();

        resolver.resolve(PROJECT_ID, true, diagram,
                CheckpointEvent.validateAndCreate(1, null, traceId, "service-a", null, "enter", "main", null, 1000L, null, null, 1L));

        HopResolver.ResolutionResult errRes = resolver.resolve(PROJECT_ID, true, diagram,
                CheckpointEvent.validateAndCreate(1, null, traceId, "db", null, "error", "main", null, 1100L, "timeout", null, 2L));
        UiEvent.HopEvent errHop = assertInstanceOf(UiEvent.HopEvent.class, errRes.uiEvents().getFirst());
        assertEquals("error", errHop.status());

        HopResolver.ResolutionResult endRes = resolver.resolve(PROJECT_ID, true, diagram,
                CheckpointEvent.validateAndCreate(1, null, traceId, "db", null, "end", "main", null, 1200L, null, null, 3L));
        assertTrue(endRes.uiEvents().stream().anyMatch(e -> e instanceof UiEvent.EndEvent));
        assertTrue(resolver.getActiveTraces(PROJECT_ID, 1250L).isEmpty());
    }

    @Test
    void rule9_idempotency_ignoresDuplicateTraceBranchSeqWithin10Seconds() {
        HopResolver resolver = new HopResolver(30_000L);
        DiagramGraph diagram = DiagramGraph.defaultSampleDiagram();
        String traceId = UuidV7.generateString();

        CheckpointEvent ev1 = CheckpointEvent.validateAndCreate(
                1, null, traceId, "website", null, "enter", "main", null, 5000L, null, null, 42L);
        CheckpointEvent evDup = CheckpointEvent.validateAndCreate(
                1, null, traceId, "website", null, "enter", "main", null, 9000L, null, null, 42L);

        assertFalse(resolver.resolve(PROJECT_ID, true, diagram, ev1).duplicateIgnored());
        assertTrue(resolver.resolve(PROJECT_ID, true, diagram, evDup).duplicateIgnored());
    }

    @Test
    void rateLimiterAndKeyHashingWorkCorrectly() {
        TokenBucketRateLimiter limiter = new TokenBucketRateLimiter();
        long t0 = 1_000_000_000L;
        assertTrue(limiter.tryAcquire("k1", 2, 2, t0));
        assertTrue(limiter.tryAcquire("k1", 2, 2, t0));
        assertFalse(limiter.tryAcquire("k1", 2, 2, t0));
        // Advance 1 second -> 2 tokens refilled
        assertTrue(limiter.tryAcquire("k1", 2, 2, t0 + 1_000_000_000L));

        ApiKeyCrypto.GeneratedKey key = ApiKeyCrypto.generateNewKey();
        assertTrue(key.fullKey().startsWith("ft_live_"));
        assertEquals(40, key.fullKey().length());
        assertEquals(64, key.keyHash().length());
    }

    @Test
    void validationRejectsInvalidEventFields() {
        assertThrows(ValidationException.class, () ->
                CheckpointEvent.validateAndCreate(1, null, "not-a-uuid", "website", null, "enter", "main", null, 100L, null, null, null));
        assertThrows(ValidationException.class, () ->
                CheckpointEvent.validateAndCreate(1, null, UuidV7.generateString(), "INVALID NODE!", null, "enter", "main", null, 100L, null, null, null));
        assertThrows(ValidationException.class, () ->
                CheckpointEvent.validateAndCreate(1, null, UuidV7.generateString(), "website", null, "enter", "main", null, 100L, "x".repeat(45), null, null));
        assertThrows(ValidationException.class, () ->
                CheckpointEvent.validateAndCreate(1, null, UuidV7.generateString(), "website", null, "enter", "main", null, 100L, null, Map.of("nested", List.of(1, 2)), null));
    }
}
