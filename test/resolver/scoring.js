"use strict";

const should = require("should");
const {
  calculateDistributionScore,
  calculateHealthScore,
  calculateResourceScore,
  combineHealthAndDNSWeights,
  normalizeScore,
  rankServices,
} = require("../../lib/resolver/scoring");
const {
  DEFAULT_METRICS,
  DEFAULT_WEIGHTS,
} = require("../../lib/resolver/types");

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

function createMockServiceWithChecks(
  id,
  address,
  port = 8080,
  checkStatuses = ["passing"],
) {
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
    Checks: checkStatuses.map((status) => ({
      Status: status,
      Output: "",
    })),
  };
}

describe("Resolver Scoring", function () {
  describe("calculateHealthScore", function () {
    it("should return 1.0 when all checks are passing", function () {
      const service = createMockServiceWithChecks(
        "service-1",
        "192.168.1.1",
        8080,
        ["passing", "passing"],
      );

      should(calculateHealthScore(service)).eql(1.0);
    });

    it("should return 0.5 when half of checks are passing", function () {
      const service = createMockServiceWithChecks(
        "service-1",
        "192.168.1.1",
        8080,
        ["passing", "critical"],
      );

      should(calculateHealthScore(service)).eql(0.5);
    });

    it("should return 0 when no checks are available", function () {
      const service = createMockServiceWithChecks(
        "service-1",
        "192.168.1.1",
        8080,
        [],
      );

      should(calculateHealthScore(service)).eql(0);
    });

    it("should return 0 when all checks are failing", function () {
      const service = createMockServiceWithChecks(
        "service-1",
        "192.168.1.1",
        8080,
        ["critical", "warning"],
      );

      should(calculateHealthScore(service)).eql(0);
    });
  });

  describe("calculateResourceScore", function () {
    it("should return 1.0 when resources are at 0%", function () {
      const metrics = {
        ...DEFAULT_METRICS,
        cpuUsage: 0,
        memoryUsage: 0,
      };

      should(calculateResourceScore(metrics)).eql(1.0);
    });

    it("should return 0.0 when resources are at 100%", function () {
      const metrics = {
        ...DEFAULT_METRICS,
        cpuUsage: 100,
        memoryUsage: 100,
      };

      should(calculateResourceScore(metrics)).eql(0.0);
    });

    it("should return 0.5 when resources are at 50%", function () {
      const metrics = {
        ...DEFAULT_METRICS,
        cpuUsage: 50,
        memoryUsage: 50,
      };

      should(calculateResourceScore(metrics)).eql(0.5);
    });

    it("should average CPU and memory scores", function () {
      const metrics = {
        ...DEFAULT_METRICS,
        cpuUsage: 0,
        memoryUsage: 100,
      };

      should(calculateResourceScore(metrics)).eql(0.5);
    });
  });

  describe("calculateDistributionScore", function () {
    it("should return 1.0 when no last selected time", function () {
      should(calculateDistributionScore()).eql(1.0);
    });

    it("should return 1.0 when last selected > 5 minutes ago", function () {
      const fiveMinutesAgo = Date.now() - 6 * 60 * 1000;
      should(calculateDistributionScore(fiveMinutesAgo)).eql(1.0);
    });

    it("should return 0.5 when last selected 2.5 minutes ago", function () {
      const twoAndHalfMinutesAgo = Date.now() - 2.5 * 60 * 1000;
      const score = calculateDistributionScore(twoAndHalfMinutesAgo);
      should(score).be.approximately(0.5, 0.1);
    });

    it("should return close to 0 when just selected", function () {
      const justNow = Date.now();
      const score = calculateDistributionScore(justNow);
      should(score).be.lessThan(0.1);
    });
  });

  describe("normalizeScore", function () {
    it("should normalize values within range", function () {
      should(normalizeScore(50, 100)).eql(0.5);
      should(normalizeScore(25, 100)).eql(0.25);
      should(normalizeScore(75, 100)).eql(0.75);
    });

    it("should clamp values above max to 1.0", function () {
      should(normalizeScore(150, 100)).eql(1.0);
    });

    it("should clamp values below 0 to 0", function () {
      should(normalizeScore(-10, 100)).eql(0);
    });

    it("should inverse when inverse=true", function () {
      should(normalizeScore(50, 100, true)).eql(0.5);
      should(normalizeScore(0, 100, true)).eql(1.0);
      should(normalizeScore(100, 100, true)).eql(0.0);
    });
  });

  describe("rankServices", function () {
    const mockServices = [
      createMockService("service-1", "192.168.1.1"),
      createMockService("service-2", "192.168.1.2"),
    ];

    it("should rank services based on composite score", function () {
      const metrics = new Map([
        [
          "service-1",
          {
            ...DEFAULT_METRICS,
            responseTime: 50,
            errorRate: 0,
            activeConnections: 5,
          },
        ],
        [
          "service-2",
          {
            ...DEFAULT_METRICS,
            responseTime: 200,
            errorRate: 10,
            activeConnections: 20,
          },
        ],
      ]);

      const ranked = rankServices(mockServices, metrics, DEFAULT_WEIGHTS);

      should(ranked.length).eql(2);
      should(ranked[0].id).eql("service-1");
      should(ranked[1].id).eql("service-2");
      should(ranked[0].score).be.greaterThan(ranked[1].score);
    });

    it("should sort services from highest to lowest score", function () {
      const metrics = new Map([
        ["service-1", { ...DEFAULT_METRICS, responseTime: 100 }],
        ["service-2", { ...DEFAULT_METRICS, responseTime: 50 }],
      ]);

      const ranked = rankServices(mockServices, metrics, DEFAULT_WEIGHTS);

      should(ranked[0].score).be.greaterThanOrEqual(ranked[1].score);
    });

    it("should throw error when metrics not found for service", function () {
      const metrics = new Map([["service-1", { ...DEFAULT_METRICS }]]);

      should(() => rankServices(mockServices, metrics, DEFAULT_WEIGHTS)).throw(
        "No metrics found for service service-2",
      );
    });

    it("should apply custom weights correctly", function () {
      const customWeights = {
        health: 1.0,
        responseTime: 0,
        errorRate: 0,
        resources: 0,
        connections: 0,
        distribution: 0,
      };

      const metrics = new Map([
        ["service-1", { ...DEFAULT_METRICS }],
        ["service-2", { ...DEFAULT_METRICS }],
      ]);

      const mockServicesWithDifferentHealth = [
        createMockServiceWithChecks("service-1", "192.168.1.1", 8080, [
          "passing",
          "passing",
        ]),
        createMockServiceWithChecks("service-2", "192.168.1.2", 8080, [
          "passing",
        ]),
      ];

      const ranked = rankServices(
        mockServicesWithDifferentHealth,
        metrics,
        customWeights,
      );

      should(ranked[0].id).eql("service-1");
    });
  });

  describe("combineHealthAndDNSWeights", function () {
    const mockService = createMockService("service-1", "192.168.1.1");

    it("should combine health and DNS weights with 70/30 ratio", function () {
      const result = combineHealthAndDNSWeights(mockService, 10, 10);

      should(result).be.approximately(1.0, 0.1);
    });

    it("should weight health more heavily (70%)", function () {
      const unhealthyService = createMockService(
        "service-1",
        "192.168.1.1",
        8080,
        "critical",
      );

      const result = combineHealthAndDNSWeights(unhealthyService, 10, 10);

      should(result).be.lessThan(0.5);
    });

    it("should normalize DNS weight", function () {
      const result1 = combineHealthAndDNSWeights(mockService, 5, 10);
      const result2 = combineHealthAndDNSWeights(mockService, 10, 10);

      should(result2).be.greaterThan(result1);
    });
  });
});
