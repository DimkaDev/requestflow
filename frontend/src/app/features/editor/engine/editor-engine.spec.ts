import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getBuiltInCatalogPacks,
  validateCatalogPack,
} from '../catalog/catalog-registry.ts';
import {
  EditorCommandHistory,
  autoLayoutDiagram,
  chooseWeightedEdge,
  ensureUniqueKey,
  findPathsBetween,
  generatePreviewRun,
  getVisibleDiagramSlice,
  isValidNodeKey,
  migrateDiagramToV2,
  resolveAliasOrNodeKey,
  SeededRandom,
  slugifyKey,
  validateDiagramGraph,
} from './editor-engine.ts';
import type { DiagramEdge, DiagramGraph, DiagramNode } from '../../../core/models.ts';

describe('Advanced Diagram Editor Engine (E26 Section 13)', () => {
  it('validates all 7 built-in catalog JSON packs and rejects invalid packs', () => {
    const packs = getBuiltInCatalogPacks();
    assert.equal(packs.length, 7, 'Must load all 7 built-in catalog packs');
    const expectedPacks = new Set([
      'standard',
      'shop',
      'aws',
      'gcp',
      'tech',
      'ai-agent',
      'business',
    ]);
    for (const pack of packs) {
      assert.ok(expectedPacks.has(pack.pack), `Unexpected pack ID: ${pack.pack}`);
      const check = validateCatalogPack(pack);
      assert.equal(
        check.valid,
        true,
        `Pack "${pack.pack}" failed schema validation: ${check.errors.join(', ')}`,
      );
      assert.ok(pack.blocks.length > 0, `Pack "${pack.pack}" must have blocks`);
    }

    const invalidCheck = validateCatalogPack({
      pack: 'BAD PACK!',
      version: 2,
      title: '',
      blocks: [],
    });
    assert.equal(invalidCheck.valid, false, 'Invalid catalog pack must be rejected');
    assert.ok(invalidCheck.errors.length >= 2);
  });

  it('slugifies keys, guarantees uniqueness, validates key format, and resolves 7-day aliases', () => {
    assert.equal(isValidNodeKey('cart-service_01.v2'), true);
    assert.equal(isValidNodeKey('Invalid Uppercase'), false);
    assert.equal(isValidNodeKey(''), false);

    assert.equal(slugifyKey('Payment Gateway #1!'), 'payment-gateway-1');
    assert.equal(
      ensureUniqueKey('cart', ['cart', 'cart-2']),
      'cart-3',
      'Must append incremented numeric suffix for duplicate keys',
    );

    const graph = migrateDiagramToV2({
      schema: 2,
      direction: 'LR',
      nodes: [
        {
          key: 'checkout_v2',
          label: 'Checkout',
          type: 'service',
          x: 100,
          y: 100,
          props: { aliases: ['checkout', 'legacy_checkout'] },
        },
      ],
      edges: [],
    });

    assert.equal(resolveAliasOrNodeKey(graph, 'checkout_v2'), 'checkout_v2');
    assert.equal(resolveAliasOrNodeKey(graph, 'legacy_checkout'), 'checkout_v2');
    assert.equal(resolveAliasOrNodeKey(graph, 'unknown_node'), 'unknown_node');
  });

  it('migrates Schema v1 diagrams to Schema v2 backward-compatibly', () => {
    const v1Diagram = {
      nodes: [
        { key: 'client', label: 'Web Client', type: 'client', x: 80, y: 160 },
        { key: 'orders', label: 'Orders API', type: 'service', x: 320, y: 160 },
      ],
      edges: [{ id: 'e1', from: 'client', to: 'orders', discovered: false }],
    };

    const v2 = migrateDiagramToV2(v1Diagram);
    assert.equal(v2.schema, 2);
    assert.equal(v2.direction, 'LR');
    assert.equal(v2.nodes[0].props?.role, 'start');
    assert.equal(v2.edges[0].source, 'client');
    assert.equal(v2.edges[0].target, 'orders');
    assert.equal(v2.edges[0].from, 'client');
    assert.equal(v2.edges[0].to, 'orders');
    assert.equal(v2.edges[0].style?.type, 'curved');
  });

  it('supports Command-pattern Undo and Redo across >= 100 steps', () => {
    const history = new EditorCommandHistory(120);
    let current = migrateDiagramToV2(null);

    for (let i = 1; i <= 105; i++) {
      const before = current;
      const after: DiagramGraph = {
        ...before,
        nodes: [
          ...before.nodes,
          {
            key: `node-${i}`,
            label: `Node ${i}`,
            type: 'service',
            x: i * 16,
            y: 120,
          },
        ],
      };
      history.record(`Add node-${i}`, before, after);
      current = after;
    }

    assert.equal(current.nodes.length, 105);
    assert.equal(history.canUndo(), true);

    for (let u = 0; u < 100; u++) {
      const prev = history.undo();
      assert.ok(prev, `Undo step ${u + 1} must succeed`);
      current = prev;
    }
    assert.equal(current.nodes.length, 5);
    assert.equal(history.canRedo(), true);

    for (let r = 0; r < 50; r++) {
      const next = history.redo();
      assert.ok(next, `Redo step ${r + 1} must succeed`);
      current = next;
    }
    assert.equal(current.nodes.length, 55);
  });

  it('evaluates all Error, Warning, and Plan limit validation rules', () => {
    const invalidGraph = migrateDiagramToV2({
      schema: 2,
      direction: 'LR',
      nodes: [
        { key: 'dup', label: 'A', type: 'service', x: 100, y: 100, props: { role: 'decision' } },
        { key: 'dup', label: 'B', type: 'service', x: 200, y: 100, props: { role: 'normal' } },
        { key: 'BAD KEY', label: 'Bad', type: 'service', x: 300, y: 100 },
      ],
      edges: [
        { id: 'e-dangling', from: 'dup', to: 'nonexistent', source: 'dup', target: 'nonexistent' },
      ],
    });

    const issues = validateDiagramGraph(
      invalidGraph,
      { maxBlocksPerDiagram: 2, allowedPacks: ['*'], canSaveCustomBlocks: true },
      new Set(['dup']),
    );

    const ids = new Set(issues.map((i) => i.id));
    assert.ok(ids.has('err-dup-key-dup'), 'Must detect duplicate block keys');
    assert.ok(ids.has('err-invalid-key-BAD KEY'), 'Must detect invalid key regex');
    assert.ok(ids.has('err-edge-tgt-e-dangling'), 'Must detect edge pointing to missing node');
    assert.ok(ids.has('err-plan-max-blocks'), 'Must detect plan block limit exceeded');
    assert.ok(ids.has('warn-decision-branches-dup'), 'Must warn when Decision has < 2 outgoing edges');
    assert.ok(ids.has('warn-broken-img-dup'), 'Must warn on broken custom icon URL');
    assert.ok(ids.has('warn-isolated-BAD KEY'), 'Must warn on isolated block');
  });

  it('executes seeded weighted decision routing, shop carry preview, and path highlighting', () => {
    const shopGraph = migrateDiagramToV2({
      schema: 2,
      direction: 'LR',
      nodes: [
        { key: 'visit', label: 'Visit', type: 'client', x: 80, y: 200, props: { role: 'start' } },
        {
          key: 'cart',
          label: 'Cart',
          type: 'service',
          x: 260,
          y: 200,
          props: { role: 'normal', carryAction: 'add' },
        },
        {
          key: 'payment-check',
          label: 'Payment Decision',
          type: 'decision',
          x: 440,
          y: 200,
          props: { role: 'decision' },
        },
        { key: 'paid', label: 'Paid', type: 'end', x: 640, y: 120, props: { role: 'success' } },
        { key: 'declined', label: 'Declined', type: 'end', x: 640, y: 280, props: { role: 'failure' } },
      ],
      edges: [
        { id: 'e1', from: 'visit', to: 'cart', source: 'visit', target: 'cart' },
        { id: 'e2', from: 'cart', to: 'payment-check', source: 'cart', target: 'payment-check' },
        {
          id: 'e-paid',
          from: 'payment-check',
          to: 'paid',
          source: 'payment-check',
          target: 'paid',
          flow: { weight: 80, expectedLatencyMs: 250 },
        },
        {
          id: 'e-declined',
          from: 'payment-check',
          to: 'declined',
          source: 'payment-check',
          target: 'declined',
          flow: { weight: 20, expectedLatencyMs: 250 },
        },
      ],
    });

    const rng = new SeededRandom(42);
    let paidHits = 0;
    const outEdges = shopGraph.edges.filter((e) => e.source === 'payment-check');
    for (let i = 0; i < 200; i++) {
      const picked = chooseWeightedEdge(outEdges, rng);
      if (picked?.target === 'paid') paidHits++;
    }
    assert.ok(paidHits > 130 && paidHits < 185, `Expected ~80% paid routing, got ${paidHits}/200`);

    const preview = generatePreviewRun(shopGraph, { seed: 42 });
    assert.ok(preview.steps.length >= 3);
    assert.ok(preview.timelineEvents.some((ev) => (ev.t || ev.type) === 'carry'));
    assert.ok(['success', 'failure'].includes(preview.terminalOutcome));

    const paths = findPathsBetween(shopGraph, 'visit', 'paid');
    assert.ok(paths.nodeKeys.has('cart'));
    assert.ok(paths.edgeIds.has('e-paid'));
  });

  it('meets <16ms 60fps performance budget on 300-block / 600-edge diagrams', () => {
    const nodes: DiagramNode[] = [];
    const edges: DiagramEdge[] = [];
    for (let i = 0; i < 300; i++) {
      nodes.push({
        key: `svc-${i}`,
        label: `Service ${i}`,
        type: i === 0 ? 'client' : i === 299 ? 'end' : 'service',
        x: (i % 20) * 220,
        y: Math.floor(i / 20) * 140,
        props: { role: i === 0 ? 'start' : i === 299 ? 'end' : 'normal' },
      });
    }
    for (let i = 0; i < 600; i++) {
      const src = `svc-${i % 299}`;
      const tgt = `svc-${(i % 299) + 1}`;
      edges.push({
        id: `edge-${i}`,
        from: src,
        to: tgt,
        source: src,
        target: tgt,
      });
    }

    const largeGraph: DiagramGraph = {
      schema: 2,
      direction: 'LR',
      nodes,
      edges,
    };

    const t0 = performance.now();
    const slice = getVisibleDiagramSlice(largeGraph, {
      panX: 0,
      panY: 0,
      zoom: 1,
      width: 1280,
      height: 800,
    });
    const cullElapsedMs = performance.now() - t0;

    assert.ok(slice.visibleNodeKeys.size > 0 && slice.visibleNodeKeys.size < 300);
    assert.ok(
      cullElapsedMs < 16,
      `300-node / 600-edge viewport culling took ${cullElapsedMs.toFixed(2)}ms (budget: < 16ms)`,
    );

    const layoutGraph = autoLayoutDiagram(
      {
        schema: 2,
        direction: 'LR',
        nodes: nodes.slice(0, 40),
        edges: edges.slice(0, 60),
      },
      'LR',
    );
    assert.equal(layoutGraph.nodes.length, 40);
  });
});
