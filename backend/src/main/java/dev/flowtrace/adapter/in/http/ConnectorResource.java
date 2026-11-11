package dev.flowtrace.adapter.in.http;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.flowtrace.application.IngestEventUseCase;
import dev.flowtrace.application.port.out.ConnectorRepository;
import dev.flowtrace.domain.*;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.util.*;

@Path("/")
public class ConnectorResource {

    private final ConnectorRepository connectorRepository;
    private final IngestEventUseCase ingestUseCase;
    private final ObjectMapper objectMapper;

    @Inject
    public ConnectorResource(
            ConnectorRepository connectorRepository,
            IngestEventUseCase ingestUseCase,
            ObjectMapper objectMapper
    ) {
        this.connectorRepository = connectorRepository;
        this.ingestUseCase = ingestUseCase;
        this.objectMapper = objectMapper;
    }

    public record CreateConnectorRequest(
            String name,
            ConnectorType type,
            WebhookMapping mapping
    ) {}

    public record CreatedConnectorResponse(
            UUID id,
            UUID projectId,
            String name,
            ConnectorType type,
            String tokenPrefix,
            String secretToken,
            WebhookMapping mapping,
            ConnectorStatus status
    ) {}

    @GET
    @Path("api/v1/projects/{projectId}/connectors")
    @Produces(MediaType.APPLICATION_JSON)
    public Response listConnectors(@PathParam("projectId") UUID projectId) {
        List<ConnectorConfig> list = connectorRepository.findByProjectId(projectId);
        return Response.ok(list).build();
    }

    @POST
    @Path("api/v1/projects/{projectId}/connectors")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response createConnector(
            @PathParam("projectId") UUID projectId,
            CreateConnectorRequest request
    ) {
        if (request == null || request.name() == null || request.name().isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST).entity(Map.of("error", "name is required")).build();
        }
        ConnectorType type = request.type() != null ? request.type() : ConnectorType.GENERIC_WEBHOOK;
        String rawSecret = "ft_hook_" + UUID.randomUUID().toString().replace("-", "") + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        String prefix = rawSecret.substring(0, 14);
        String hash = ApiKeyCrypto.sha256Hex(rawSecret);

        WebhookMapping mapping = request.mapping();
        if (mapping == null) {
            mapping = switch (type) {
                case SHOPIFY_WEBHOOK -> WebhookMapping.shopifyOrderPreset();
                case WOOCOMMERCE_WEBHOOK -> WebhookMapping.woocommerceOrderPreset();
                case STRIPE_WEBHOOK -> WebhookMapping.stripeChargePreset();
                default -> WebhookMapping.genericPreset();
            };
        }

        ConnectorConfig config = ConnectorConfig.create(projectId, request.name().trim(), type, prefix, hash, mapping);
        connectorRepository.save(config);

        CreatedConnectorResponse response = new CreatedConnectorResponse(
                config.id(),
                config.projectId(),
                config.name(),
                config.type(),
                config.tokenPrefix(),
                rawSecret,
                config.mapping(),
                config.status()
        );
        return Response.status(Response.Status.CREATED).entity(response).build();
    }

    @DELETE
    @Path("api/v1/projects/{projectId}/connectors/{connectorId}")
    public Response deleteConnector(
            @PathParam("projectId") UUID projectId,
            @PathParam("connectorId") UUID connectorId
    ) {
        connectorRepository.delete(projectId, connectorId);
        return Response.noContent().build();
    }

    @POST
    @Path("api/v1/projects/{projectId}/connectors/{connectorId}/test")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response testMapping(
            @PathParam("projectId") UUID projectId,
            @PathParam("connectorId") UUID connectorId,
            Map<String, Object> sampleJson
    ) {
        Optional<ConnectorConfig> opt = connectorRepository.findById(projectId, connectorId);
        if (opt.isEmpty()) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }
        ConnectorConfig config = opt.get();
        CheckpointEvent parsed = WebhookPayloadParser.parse("preview_key", sampleJson, config.mapping(), System.currentTimeMillis());
        return Response.ok(parsed).build();
    }

    @POST
    @Path("api/v1/connectors/webhook/{secretToken}")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response receiveWebhook(
            @PathParam("secretToken") String secretToken,
            Map<String, Object> rawPayload
    ) {
        if (secretToken == null || secretToken.isBlank()) {
            return Response.status(Response.Status.UNAUTHORIZED).entity(Map.of("error", "missing secret token")).build();
        }
        String hash = ApiKeyCrypto.sha256Hex(secretToken);
        Optional<ConnectorConfig> opt = connectorRepository.findByTokenHash(hash);
        if (opt.isEmpty()) {
            return Response.status(Response.Status.UNAUTHORIZED).entity(Map.of("error", "invalid connector webhook token")).build();
        }

        ConnectorConfig connector = opt.get();
        try {
            long now = System.currentTimeMillis();
            CheckpointEvent event = WebhookPayloadParser.parse("wh_" + connector.tokenPrefix(), rawPayload, connector.mapping(), now);

            ingestUseCase.ingestForProject("webhook", connector.projectId(), event);
            connectorRepository.recordEventReceived(connector.id(), ConnectorStatus.CONNECTED, null);

            return Response.ok(Map.of(
                    "status", "ok",
                    "traceId", event.traceId(),
                    "node", event.node()
            )).build();
        } catch (Exception e) {
            connectorRepository.recordEventReceived(connector.id(), ConnectorStatus.ERROR, e.getMessage());
            return Response.status(Response.Status.BAD_REQUEST).entity(Map.of("error", e.getMessage())).build();
        }
    }

    @GET
    @Path("flowtrace.js")
    @Produces("application/javascript;charset=UTF-8")
    public Response serveStorefrontScript() {
        String js = """
            (function(window) {
              'use strict';
              var _apiKey = null;
              var _endpoint = '/api/v1/events';
              var _sessionId = null;
              function getSessionId() {
                if (_sessionId) return _sessionId;
                try {
                  _sessionId = window.sessionStorage.getItem('ft_sid');
                  if (!_sessionId) {
                    _sessionId = '0194f1c0-0000-7000-8000-' + Math.random().toString(16).substring(2, 14);
                    window.sessionStorage.setItem('ft_sid', _sessionId);
                  }
                } catch (e) {
                  _sessionId = '0194f1c0-0000-7000-8000-' + Math.random().toString(16).substring(2, 14);
                }
                return _sessionId;
              }
              var FlowTrace = {
                init: function(config) {
                  if (!config) return;
                  if (typeof config === 'string') {
                    _apiKey = config;
                  } else {
                    _apiKey = config.apiKey || _apiKey;
                    _endpoint = config.endpoint || _endpoint;
                  }
                },
                track: function(node, data) {
                  if (!_apiKey) {
                    console.warn('[FlowTrace] track called before init(apiKey)');
                    return;
                  }
                  data = data || {};
                  var traceId = data.traceId || getSessionId();
                  var payload = [{
                    v: 1,
                    traceId: traceId,
                    node: node || 'browse',
                    attrs: data.attrs || {},
                    entity: data.customer ? {
                      ref: data.customer.id || getSessionId(),
                      name: data.customer.name || 'Shopper',
                      avatar: data.customer.avatar || 'shopper'
                    } : undefined,
                    carry: data.cart ? {
                      op: data.cart.op || 'add',
                      items: data.cart.items || [],
                      totalAmount: data.cart.totalAmount || 0,
                      currency: data.cart.currency || 'EUR'
                    } : undefined
                  }];
                  var body = JSON.stringify(payload);
                  var url = _endpoint;
                  if (navigator.sendBeacon) {
                    var blob = new Blob([body], { type: 'application/json' });
                    var ok = navigator.sendBeacon(url + '?key=' + encodeURIComponent(_apiKey), blob);
                    if (ok) return;
                  }
                  if (typeof fetch !== 'undefined') {
                    fetch(url, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'X-API-Key': _apiKey
                      },
                      body: body,
                      keepalive: true
                    }).catch(function() {});
                  }
                }
              };
              if (typeof document !== 'undefined') {
                var scripts = document.getElementsByTagName('script');
                for (var i = 0; i < scripts.length; i++) {
                  var s = scripts[i];
                  if (s.src && s.src.indexOf('flowtrace.js') !== -1) {
                    var key = s.getAttribute('data-api-key');
                    var ep = s.getAttribute('data-endpoint');
                    if (key) {
                      FlowTrace.init({ apiKey: key, endpoint: ep || undefined });
                    }
                  }
                }
              }
              window.FlowTrace = FlowTrace;
            })(typeof window !== 'undefined' ? window : this);
            """;
        return Response.ok(js).header("Cache-Control", "public, max-age=3600").build();
    }
}
