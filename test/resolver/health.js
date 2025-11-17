"use strict";

const should = require("should");
const RedisMock = require("ioredis-mock");
const { HealthCheckManager } = require("../../lib/resolver/health");

const helper = require("../helper");

describe("Resolver Health", function () {
  helper.setup(this);

  let redis;
  let healthManager;

  beforeEach(function () {
    redis = new RedisMock();
    healthManager = new HealthCheckManager(
      this.consul,
      redis,
      "test-consul",
      60,
      true,
      false,
    );
  });

  afterEach(async function () {
    await redis.flushall();
    redis.disconnect();
  });

  describe("getHealthChecks", function () {
    it("should fetch health checks from Consul", async function () {
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

      const result = await healthManager.getHealthChecks("test-service");
      should(result).eql(healthChecks);
    });

    it("should cache health checks", async function () {
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

      this.nock
        .get("/v1/health/service/test-service")
        .once()
        .reply(200, healthChecks);

      const result1 = await healthManager.getHealthChecks("test-service");
      const result2 = await healthManager.getHealthChecks("test-service");

      should(result1).eql(healthChecks);
      should(result2).eql(healthChecks);
    });

    it("should return empty array on error", async function () {
      this.nock.get("/v1/health/service/test-service").reply(500);

      const result = await healthManager.getHealthChecks("test-service");
      should(result).eql([]);
    });

    it("should work without cache", async function () {
      const noCacheManager = new HealthCheckManager(
        this.consul,
        undefined,
        "test-consul",
        60,
        false,
        false,
      );

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

      const result = await noCacheManager.getHealthChecks("test-service");
      should(result).eql(healthChecks);
    });
  });
});
