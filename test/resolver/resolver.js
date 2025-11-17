"use strict";

const should = require("should");
const RedisMock = require("ioredis-mock");

const helper = require("../helper");
const { SelectionAlgorithm } = require("../../lib/resolver");

describe("Resolver", function () {
  helper.setup(this);

  let redis;
  let resolver;
  let dnsQueryStub;

  beforeEach(function () {
    redis = new RedisMock();
    resolver = this.consul.resolver({
      redis,
      cacheEnabled: true,
      cachePrefix: "test-consul",
      debug: false,
    });

    const dnsQuery = require("dns-query");
    dnsQueryStub = this.sinon
      .stub(dnsQuery, "query")
      .resolves({ answers: [], additionals: [] });
  });

  afterEach(async function () {
    if (dnsQueryStub) {
      dnsQueryStub.restore();
    }
    if (redis) {
      await redis.flushall();
      redis.disconnect();
    }
  });

  describe("constructor", function () {
    it("should create resolver with default config", function () {
      const r = this.consul.resolver({
        cacheEnabled: false,
        cachePrefix: "test",
      });
      should(r).be.ok();
    });

    it("should create resolver with custom weights and metrics", function () {
      const r = this.consul.resolver({
        cacheEnabled: false,
        cachePrefix: "test",
        weights: {
          health: 0.5,
          responseTime: 0.3,
          errorRate: 0.2,
          resources: 0,
          connections: 0,
          distribution: 0,
        },
        metrics: {
          responseTime: 200,
          errorRate: 5,
          cpuUsage: 60,
          memoryUsage: 70,
          activeConnections: 0,
        },
      });
      should(r).be.ok();
    });
  });

  describe("selectOptimalService", function () {
    it("should return null when no services available", async function () {
      this.nock.get("/v1/health/service/test-service").reply(200, []);
      this.nock.get(/\/v1\/.*/).reply(200, { answers: [], additionals: [] });

      const result = await resolver.selectOptimalService("test-service");
      should(result.selected).be.null();
      should(result.services).eql([]);
    });

    it("should select service using round robin", async function () {
      const healthChecks = [
        {
          Node: { Node: "node1", Address: "192.168.1.1" },
          Service: {
            ID: "service-1",
            Service: "test-service",
            Tags: [],
            Address: "192.168.1.1",
            Port: 8080,
          },
          Checks: [{ Status: "passing", Output: "" }],
        },
        {
          Node: { Node: "node2", Address: "192.168.1.2" },
          Service: {
            ID: "service-2",
            Service: "test-service",
            Tags: [],
            Address: "192.168.1.2",
            Port: 8080,
          },
          Checks: [{ Status: "passing", Output: "" }],
        },
      ];

      this.nock.get("/v1/health/service/test-service").reply(200, healthChecks);

      const result = await resolver.selectOptimalService(
        "test-service",
        SelectionAlgorithm.RoundRobin,
      );
      should(result.selected).not.be.null();
      should(result.selected.ip).be.oneOf(["192.168.1.1", "192.168.1.2"]);
      should(result.services.length).eql(2);
    });

    it("should select service using least connection", async function () {
      const healthChecks = [
        {
          Node: { Node: "node1", Address: "192.168.1.1" },
          Service: {
            ID: "service-1",
            Service: "test-service",
            Tags: [],
            Address: "192.168.1.1",
            Port: 8080,
          },
          Checks: [{ Status: "passing", Output: "" }],
        },
        {
          Node: { Node: "node2", Address: "192.168.1.2" },
          Service: {
            ID: "service-2",
            Service: "test-service",
            Tags: [],
            Address: "192.168.1.2",
            Port: 8080,
          },
          Checks: [{ Status: "passing", Output: "" }],
        },
      ];

      this.nock.get("/v1/health/service/test-service").reply(200, healthChecks);
      this.nock.get(/\/v1\/.*/).reply(200, { answers: [], additionals: [] });

      await resolver.incrementConnections("service-1");
      await resolver.incrementConnections("service-1");

      const result = await resolver.selectOptimalService(
        "test-service",
        SelectionAlgorithm.LeastConnection,
      );
      should(result.selected).not.be.null();
      should(result.selected.ip).eql("192.168.1.2");
    });

    it("should select service using weighted round robin", async function () {
      const healthChecks = [
        {
          Node: { Node: "node1", Address: "192.168.1.1" },
          Service: {
            ID: "service-1",
            Service: "test-service",
            Tags: [],
            Address: "192.168.1.1",
            Port: 8080,
          },
          Checks: [{ Status: "passing", Output: "" }],
        },
        {
          Node: { Node: "node2", Address: "192.168.1.2" },
          Service: {
            ID: "service-2",
            Service: "test-service",
            Tags: [],
            Address: "192.168.1.2",
            Port: 8080,
          },
          Checks: [{ Status: "passing", Output: "" }],
        },
      ];

      this.nock.get("/v1/health/service/test-service").reply(200, healthChecks);
      this.nock.get(/\/v1\/.*/).reply(200, { answers: [], additionals: [] });

      const result = await resolver.selectOptimalService(
        "test-service",
        SelectionAlgorithm.WeightedRoundRobin,
      );
      should(result.selected).not.be.null();
      should(result.services.length).eql(2);
    });

    it("should use DNS records when no health checks", async function () {
      const { query } = require("dns-query");
      const originalQuery = query;

      require.cache[require.resolve("dns-query")].exports.query = async () => ({
        answers: [
          {
            data: {
              target: "srv1.example.com",
              port: 8080,
              priority: 10,
              weight: 5,
            },
          },
        ],
        additionals: [
          {
            type: "A",
            name: "srv1.example.com",
            data: "192.168.1.1",
          },
        ],
      });

      this.nock.get("/v1/health/service/test-service").reply(200, []);

      const result = await resolver.selectOptimalService("test-service");
      should(result.selected).not.be.null();
      should(result.selected.ip).eql("192.168.1.1");

      require.cache[require.resolve("dns-query")].exports.query = originalQuery;
    });

    it("should match DNS and health checks", async function () {
      const { query } = require("dns-query");
      const originalQuery = query;

      require.cache[require.resolve("dns-query")].exports.query = async () => ({
        answers: [
          {
            data: {
              target: "srv1.example.com",
              port: 8080,
              priority: 10,
              weight: 5,
            },
          },
        ],
        additionals: [
          {
            type: "A",
            name: "srv1.example.com",
            data: "192.168.1.1",
          },
        ],
      });

      const healthChecks = [
        {
          Node: { Node: "node1", Address: "192.168.1.1" },
          Service: {
            ID: "service-1",
            Service: "test-service",
            Tags: [],
            Address: "192.168.1.1",
            Port: 8080,
          },
          Checks: [{ Status: "passing", Output: "" }],
        },
      ];

      this.nock.get("/v1/health/service/test-service").reply(200, healthChecks);

      const result = await resolver.selectOptimalService("test-service");
      should(result.selected).not.be.null();
      should(result.selected.ip).eql("192.168.1.1");

      require.cache[require.resolve("dns-query")].exports.query = originalQuery;
    });

    it("should handle errors gracefully", async function () {
      this.nock.get("/v1/health/service/test-service").reply(500);
      dnsQueryStub.rejects(new Error("DNS error"));

      const result = await resolver.selectOptimalService("test-service");
      should(result.selected).be.null();
      should(result.services).eql([]);
    });
  });

  describe("incrementConnections", function () {
    it("should increment connections", async function () {
      await resolver.incrementConnections("service-1");
      const metrics = await resolver.getSelectionMetrics("service-1");
      should(metrics?.activeConnections).eql(1);
    });
  });

  describe("decrementConnections", function () {
    it("should decrement connections", async function () {
      await resolver.incrementConnections("service-1");
      await resolver.incrementConnections("service-1");
      await resolver.decrementConnections("service-1");
      const metrics = await resolver.getSelectionMetrics("service-1");
      should(metrics?.activeConnections).eql(1);
    });
  });

  describe("getSelectionMetrics", function () {
    it("should return null when cache disabled", async function () {
      const noCacheResolver = this.consul.resolver({
        cacheEnabled: false,
        cachePrefix: "test-consul",
      });

      const metrics = await noCacheResolver.getSelectionMetrics("service-1");
      should(metrics).be.null();
    });

    it("should return metrics when available", async function () {
      await resolver.incrementConnections("service-1");
      const metrics = await resolver.getSelectionMetrics("service-1");
      should(metrics).not.be.null();
      should(metrics?.activeConnections).eql(1);
    });
  });

  describe("refresh", function () {
    it("should clear all cache keys", async function () {
      await resolver.incrementConnections("service-1");
      await resolver.refresh();

      const metrics = await resolver.getSelectionMetrics("service-1");
      should(metrics).be.null();
    });

    it("should do nothing when cache disabled", async function () {
      const noCacheResolver = this.consul.resolver({
        cacheEnabled: false,
        cachePrefix: "test-consul",
      });

      await noCacheResolver.refresh();
      // Should not throw
    });
  });
});
