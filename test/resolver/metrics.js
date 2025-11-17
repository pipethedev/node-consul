"use strict";

const should = require("should");
const RedisMock = require("ioredis-mock");
const { MetricsManager } = require("../../lib/resolver/metrics");
const { DEFAULT_METRICS } = require("../../lib/resolver/types");

function createMockService(id, address, port = 8080, checkStatus = "passing") {
  return {
    Node: {
      Node: `node-${id}`,
      Address: address,
    },
    Service: {
      ID: id,
      Service: "api",
      Tags: [],
      Address: address,
      Port: port,
    },
    Checks: [
      {
        Status: checkStatus,
        Output: "",
      },
    ],
  };
}

describe("Resolver Metrics", function () {
  let redis;
  let metricsManager;

  beforeEach(function () {
    redis = new RedisMock();
    metricsManager = new MetricsManager(
      redis,
      "test-consul",
      DEFAULT_METRICS,
      true,
      false,
    );
  });

  afterEach(async function () {
    await redis.flushall();
    redis.disconnect();
  });

  describe("incrementConnections", function () {
    it("should increment connections for a service", async function () {
      await metricsManager.incrementConnections("service-1");

      const metrics = await metricsManager.getSelectionMetrics("service-1");
      should(metrics?.activeConnections).eql(1);
    });

    it("should increment existing connections", async function () {
      await metricsManager.incrementConnections("service-1");
      await metricsManager.incrementConnections("service-1");
      await metricsManager.incrementConnections("service-1");

      const metrics = await metricsManager.getSelectionMetrics("service-1");
      should(metrics?.activeConnections).eql(3);
    });

    it("should handle multiple services independently", async function () {
      await metricsManager.incrementConnections("service-1");
      await metricsManager.incrementConnections("service-2");
      await metricsManager.incrementConnections("service-1");

      const metrics1 = await metricsManager.getSelectionMetrics("service-1");
      const metrics2 = await metricsManager.getSelectionMetrics("service-2");

      should(metrics1?.activeConnections).eql(2);
      should(metrics2?.activeConnections).eql(1);
    });
  });

  describe("decrementConnections", function () {
    it("should decrement connections for a service", async function () {
      await metricsManager.incrementConnections("service-1");
      await metricsManager.incrementConnections("service-1");
      await metricsManager.decrementConnections("service-1");

      const metrics = await metricsManager.getSelectionMetrics("service-1");
      should(metrics?.activeConnections).eql(1);
    });

    it("should not go below zero", async function () {
      await metricsManager.decrementConnections("service-1");
      await metricsManager.decrementConnections("service-1");

      const metrics = await metricsManager.getSelectionMetrics("service-1");
      should(metrics?.activeConnections).eql(0);
    });

    it("should handle decrementing non-existent service", async function () {
      await metricsManager.decrementConnections("non-existent");

      const metrics = await metricsManager.getSelectionMetrics("non-existent");
      should(metrics?.activeConnections).eql(0);
    });
  });

  describe("updateSelectionMetrics", function () {
    it("should update last selected time", async function () {
      const beforeTime = Date.now();
      await metricsManager.updateSelectionMetrics("service-1");
      const afterTime = Date.now();

      const metrics = await metricsManager.getSelectionMetrics("service-1");

      should(metrics?.lastSelectedTime).be.ok();
      should(metrics?.lastSelectedTime).be.greaterThanOrEqual(beforeTime);
      should(metrics?.lastSelectedTime).be.lessThanOrEqual(afterTime);
    });

    it("should preserve other metrics when updating selection time", async function () {
      await metricsManager.incrementConnections("service-1");
      await metricsManager.updateSelectionMetrics("service-1");

      const metrics = await metricsManager.getSelectionMetrics("service-1");

      should(metrics?.activeConnections).eql(1);
      should(metrics?.lastSelectedTime).be.ok();
    });
  });

  describe("getServicesMetrics", function () {
    const mockServices = [
      createMockService("service-1", "192.168.1.1"),
      createMockService("service-2", "192.168.1.2"),
    ];

    it("should return default metrics when no data exists", async function () {
      const metricsMap = await metricsManager.getServicesMetrics(mockServices);

      should(metricsMap.size).eql(2);
      should(metricsMap.get("service-1")).eql(DEFAULT_METRICS);
      should(metricsMap.get("service-2")).eql(DEFAULT_METRICS);
    });

    it("should return stored metrics with connection counts", async function () {
      await metricsManager.incrementConnections("service-1");
      await metricsManager.incrementConnections("service-1");
      await metricsManager.incrementConnections("service-2");

      const metricsMap = await metricsManager.getServicesMetrics(mockServices);

      should(metricsMap.get("service-1")?.activeConnections).eql(2);
      should(metricsMap.get("service-2")?.activeConnections).eql(1);
    });

    it("should handle mixed scenarios with some services having metrics", async function () {
      await metricsManager.incrementConnections("service-1");

      const metricsMap = await metricsManager.getServicesMetrics(mockServices);

      should(metricsMap.get("service-1")?.activeConnections).eql(1);
      should(metricsMap.get("service-2")?.activeConnections).eql(0);
    });
  });

  describe("getSelectionMetrics", function () {
    it("should return null when no metrics exist", async function () {
      const metrics = await metricsManager.getSelectionMetrics("non-existent");
      should(metrics).be.null();
    });

    it("should return stored metrics", async function () {
      await metricsManager.incrementConnections("service-1");
      await metricsManager.updateSelectionMetrics("service-1");

      const metrics = await metricsManager.getSelectionMetrics("service-1");

      should(metrics).not.be.null();
      should(metrics?.activeConnections).eql(1);
      should(metrics?.lastSelectedTime).be.ok();
    });
  });

  describe("cache disabled scenario", function () {
    it("should return null when cache is disabled", async function () {
      const disabledManager = new MetricsManager(
        redis,
        "test-consul",
        DEFAULT_METRICS,
        false,
        false,
      );

      await disabledManager.incrementConnections("service-1");
      const metrics = await disabledManager.getSelectionMetrics("service-1");

      should(metrics).be.null();
    });

    it("should return default metrics when cache disabled", async function () {
      const disabledManager = new MetricsManager(
        redis,
        "test-consul",
        DEFAULT_METRICS,
        false,
        false,
      );

      const mockServices = [
        createMockService("service-1", "192.168.1.1"),
        createMockService("service-2", "192.168.1.2"),
      ];

      const metricsMap = await disabledManager.getServicesMetrics(mockServices);
      should(metricsMap.size).eql(2);
      should(metricsMap.get("service-1")).eql(DEFAULT_METRICS);
    });
  });

  describe("error handling", function () {
    it("should handle Redis pipeline errors gracefully", async function () {
      const errorRedis = new RedisMock();
      const errorManager = new MetricsManager(
        errorRedis,
        "test-consul",
        DEFAULT_METRICS,
        true,
        false,
      );

      // Force an error by disconnecting
      errorRedis.disconnect();

      const mockServices = [createMockService("service-1", "192.168.1.1")];

      const metricsMap = await errorManager.getServicesMetrics(mockServices);
      should(metricsMap.size).eql(1);
      should(metricsMap.get("service-1")).eql(DEFAULT_METRICS);
    });

    it("should handle JSON parse errors", async function () {
      await redis.set("test-consul:connections:service-1", "invalid-json");

      const mockServices = [createMockService("service-1", "192.168.1.1")];

      const metricsMap = await metricsManager.getServicesMetrics(mockServices);
      should(metricsMap.size).eql(1);
      should(metricsMap.get("service-1")).eql(DEFAULT_METRICS);
    });

    it("should handle errors in incrementConnections", async function () {
      const errorRedis = new RedisMock();
      errorRedis.disconnect();

      const errorManager = new MetricsManager(
        errorRedis,
        "test-consul",
        DEFAULT_METRICS,
        true,
        false,
      );

      await errorManager.incrementConnections("service-1");
      // Should not throw
    });

    it("should handle errors in decrementConnections", async function () {
      const errorRedis = new RedisMock();
      errorRedis.disconnect();

      const errorManager = new MetricsManager(
        errorRedis,
        "test-consul",
        DEFAULT_METRICS,
        true,
        false,
      );

      await errorManager.decrementConnections("service-1");
      // Should not throw
    });

    it("should handle errors in updateSelectionMetrics", async function () {
      const errorRedis = new RedisMock();
      errorRedis.disconnect();

      const errorManager = new MetricsManager(
        errorRedis,
        "test-consul",
        DEFAULT_METRICS,
        true,
        false,
      );

      await errorManager.updateSelectionMetrics("service-1");
      // Should not throw
    });

    it("should handle errors in getSelectionMetrics", async function () {
      const errorRedis = new RedisMock();
      errorRedis.disconnect();

      const errorManager = new MetricsManager(
        errorRedis,
        "test-consul",
        DEFAULT_METRICS,
        true,
        false,
      );

      const metrics = await errorManager.getSelectionMetrics("service-1");
      should(metrics).be.null();
    });
  });
});
