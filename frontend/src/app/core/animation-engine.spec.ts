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

  it('computes tangent angle, shortTag, and staggered SVG path for hop transition variants', () => {
    const engine = new AnimationEngine();
    engine.setGraph({
      schema: 1,
      direction: 'TB',
      nodes: [
        { key: 'a', label: 'Ingress', type: 'source', x: 0, y: 0 },
        { key: 'b', label: 'Worker', type: 'service', x: 180, y: 200 },
      ],
      edges: [{ id: 'e1', from: 'a', to: 'b', label: 'route=A' }],
    });

    engine.enqueueHop(
      {
        t: 'hop',
        traceId: '0194f1c0-0000-7000-8000-00000000abcd',
        branch: 'main',
        from: 'a',
        to: 'b',
        edgeId: 'e1',
        unmapped: false,
        status: 'ok',
        label: 'POST /pay',
        ts: 1000,
      },
      1000
    );

    engine.step(1300);
    const tok = engine.getTokens()[0];
    assert.equal(tok.shortTag, 'POST /pa');
    assert.ok(tok.easedProgress > 0 && tok.easedProgress < 1);
    assert.ok(tok.angleDeg > 0 && tok.angleDeg < 90);
    const svgPath = engine.buildEdgeSvgPath('a', 'b', tok.staggerOffsetPx);
    assert.ok(svgPath.startsWith('M '));
  });

  it('renders entity customer avatar, tracks carry state, and handles terminal business events', () => {
    const engine = new AnimationEngine();
    engine.setGraph(SAMPLE_GRAPH);

    // 1. Spawn with entity avatar and initial empty/cart state
    engine.enqueueSpawn(
      {
        t: 'spawn',
        traceId: 'trace-buyer-1',
        branch: 'main',
        node: 'website',
        status: 'ok',
        entity: {
          kind: 'customer',
          ref: 'cust_101',
          label: 'Alice',
          avatar: 'woman_technologist',
        },
        carry: {
          count: 1,
          total: 24.5,
          currency: 'EUR',
          topIcons: ['candle'],
        },
        ts: 1000,
      },
      1000
    );

    const initial = engine.getTokens()[0];
    assert.ok(initial);
    assert.equal(initial.entity?.label, 'Alice');
    assert.equal(initial.avatarIcon, '👩‍💻');
    assert.equal(initial.carry?.count, 1);
    assert.equal(initial.carry?.total, 24.5);
    assert.deepEqual(initial.carriedIcons, ['🕯️']);

    // 2. Enqueue carry update
    engine.enqueueCarry(
      {
        t: 'carry',
        traceId: 'trace-buyer-1',
        branch: 'main',
        node: 'website',
        op: 'add',
        carry: {
          count: 2,
          total: 42.0,
          currency: 'EUR',
          topIcons: ['candle', 'coffee'],
        },
        ts: 1100,
      },
      1100
    );

    const updated = engine.getTokens()[0];
    assert.equal(updated.carry?.count, 2);
    assert.equal(updated.carry?.total, 42.0);
    assert.deepEqual(updated.carriedIcons, ['🕯️', '☕']);

    // 3. Complete event (order paid)
    engine.enqueueComplete(
      {
        t: 'complete',
        traceId: 'trace-buyer-1',
        branch: 'main',
        node: 'db',
        entity: initial.entity,
        carry: updated.carry,
        ts: 1200,
      },
      1200
    );

    // Step to advance into complete
    engine.step(1210);
    const completedTok = engine.getTokens()[0];
    assert.ok(completedTok);
    assert.equal(completedTok.phase, 'fading');
    assert.equal(completedTok.status, 'ok');
    assert.equal(completedTok.shortTag, 'PAID');
    assert.equal(completedTok.entity?.label, 'Alice');
  });

  it('handles fail and abandon terminal events', () => {
    const engine = new AnimationEngine();
    engine.setGraph(SAMPLE_GRAPH);

    // Fail event
    engine.enqueueFail(
      {
        t: 'fail',
        traceId: 'trace-fail-1',
        branch: 'main',
        node: 'lb',
        entity: { kind: 'customer', ref: 'c2', label: 'Bob', avatar: 'man_artist' },
        ts: 1000,
      },
      1000
    );
    engine.step(1010);
    const failedTok = engine.getTokens()[0];
    assert.ok(failedTok);
    assert.equal(failedTok.status, 'error');
    assert.equal(failedTok.shortTag, 'FAIL');
    assert.equal(failedTok.avatarIcon, '👨‍🎨');

    // Abandon event
    engine.enqueueAbandon(
      {
        t: 'abandon',
        traceId: 'trace-abandon-1',
        branch: 'main',
        node: 'website',
        entity: { kind: 'customer', ref: 'c3', label: 'Charlie', avatar: 'shopping_cart' },
        ts: 2000,
      },
      2000
    );
    engine.step(2010);
    const abandonedTok = engine.getTokens().find((t) => t.traceId === 'trace-abandon-1');
    assert.ok(abandonedTok);
    assert.equal(abandonedTok.status, 'warn');
    assert.equal(abandonedTok.shortTag, 'LEFT');
    assert.equal(abandonedTok.avatarIcon, '🛒');
  });
});
