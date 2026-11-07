import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AnimationEngine } from './animation-engine.ts';
import type { DiagramGraph } from './models.ts';

const SAMPLE_GRAPH: DiagramGraph = {
  schema: 1,
  direction: 'TB',
  nodes: [
    { key: 'website', label: 'Website', type: 'source', x: 0, y: 0 },
    { key: 'lb', label: 'Load Balancer', type: 'service', x: 0, y: 160 },
    { key: 'db', label: 'Database', type: 'datastore', x: 0, y: 320 },
  ],
  edges: [
    { id: 'e1', from: 'website', to: 'lb' },
    { id: 'e2', from: 'lb', to: 'db' },
  ],
};

describe('AnimationEngine (spec section 10.3)', () => {
  it('spawns, travels along Bezier edge with trail, pulses target node, and fades on end', () => {
    const engine = new AnimationEngine();
    engine.setGraph(SAMPLE_GRAPH);

    // 1. Spawn at website
    engine.enqueueSpawn(
      { t: 'spawn', traceId: 't1', branch: 'main', node: 'website', status: 'ok', ts: 1000 },
      1000
    );
    assert.equal(engine.getTokens().length, 1);
    assert.equal(engine.getTokens()[0].phase, 'spawning');

    // Queue a hop while spawning
    engine.enqueueHop(
      {
        t: 'hop',
        traceId: 't1',
        branch: 'main',
        from: 'website',
        to: 'lb',
        edgeId: 'e1',
        unmapped: false,
        status: 'ok',
        ts: 1050,
      },
      1050
    );

    // Complete spawn (200ms) -> transitions to traveling hop
    engine.step(1210);
    assert.equal(engine.getTokens().length, 1);
    const traveling = engine.getTokens()[0];
    assert.equal(traveling.phase, 'traveling');
    assert.equal(traveling.fromNode, 'website');
    assert.equal(traveling.toNode, 'lb');

    // Step mid-flight -> coordinates move between website and lb and trail is populated
    engine.step(1500);
    const mid = engine.getTokens()[0];
    assert.ok(mid.y > 64 && mid.y < 160);
    assert.ok(mid.trail.length > 0);

    // Finish hop -> node arrival pulse triggered on lb
    engine.step(2000);
    assert.equal(engine.getTokens().length, 0);
    assert.ok(engine.getNodeEffect('lb'));
  });

  it('shortens hop durations in realtime catch-up mode when queue grows', () => {
    const engine = new AnimationEngine();
    engine.mode = 'realtime';
    engine.speedMultiplier = 1.0;

    const singleHopMs = engine.computeHopDurationMs(0);
    const backlogHopMs = engine.computeHopDurationMs(5);
    assert.equal(singleHopMs, 600);
    assert.ok(backlogHopMs < singleHopMs);
    assert.ok(backlogHopMs >= 150);
  });

  it('creates ghost edge and warn status for unmapped hops', () => {
    const engine = new AnimationEngine();
    engine.setGraph(SAMPLE_GRAPH);

    engine.enqueueHop(
      {
        t: 'hop',
        traceId: 't2',
        branch: 'main',
        from: 'website',
        to: 'db',
        edgeId: null,
        unmapped: true,
        status: 'ok',
        ts: 1000,
      },
      1000
    );

    assert.equal(engine.getTokens().length, 1);
    assert.equal(engine.getTokens()[0].status, 'warn');
    assert.equal(engine.getGhostEdges().length, 1);
  });

  it('caps concurrent tokens at maxConcurrentTokens and enables sampling mode', () => {
    const engine = new AnimationEngine();
    engine.setGraph(SAMPLE_GRAPH);
    engine.maxConcurrentTokens = 3;

    for (let i = 0; i < 5; i++) {
      engine.enqueueSpawn(
        { t: 'spawn', traceId: `trace-${i}`, branch: 'main', node: 'website', status: 'ok', ts: 1000 },
        1000
      );
    }

    assert.equal(engine.getTokens().length, 3);
    assert.equal(engine.isSampling(), true);
  });
});
