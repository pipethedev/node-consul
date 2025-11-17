"use strict";

const should = require("should");
const {
  leastConnectionSelection,
  roundRobinSelection,
  roundRobinSrvSelection,
  weightedRandomSelection,
  weightedSrvRecordSelection,
} = require("../../lib/resolver/algorithms");
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

describe("Resolver Algorithms", function () {
  describe("roundRobinSelection", function () {
    const mockServices = [
      createMockService("service-1", "192.168.1.1"),
      createMockService("service-2", "192.168.1.2"),
      createMockService("service-3", "192.168.1.3"),
    ];

    it("should select services in round-robin order", function () {
      const result1 = roundRobinSelection(mockServices, 0);
      should(result1.id).eql("service-1");
      should(result1.nextIndex).eql(1);

      const result2 = roundRobinSelection(mockServices, result1.nextIndex);
      should(result2.id).eql("service-2");
      should(result2.nextIndex).eql(2);

      const result3 = roundRobinSelection(mockServices, result2.nextIndex);
      should(result3.id).eql("service-3");
      should(result3.nextIndex).eql(0);
    });

    it("should wrap around to the first service", function () {
      const result = roundRobinSelection(mockServices, 3);
      should(result.id).eql("service-1");
      should(result.nextIndex).eql(1);
    });

    it("should throw error when no healthy services available", function () {
      const unhealthyServices = [
        createMockService("service-1", "192.168.1.1", 8080, "critical"),
      ];

      should(() => roundRobinSelection(unhealthyServices, 0)).throw(
        "No healthy services available",
      );
    });

    it("should filter out unhealthy services", function () {
      const mixedServices = [
        ...mockServices,
        createMockService("service-4", "192.168.1.4", 8080, "critical"),
      ];

      const result1 = roundRobinSelection(mixedServices, 0);
      const result2 = roundRobinSelection(mixedServices, result1.nextIndex);
      const result3 = roundRobinSelection(mixedServices, result2.nextIndex);

      should([result1.id, result2.id, result3.id]).not.containEql("service-4");
    });
  });

  describe("leastConnectionSelection", function () {
    const mockServices = [
      createMockService("service-1", "192.168.1.1"),
      createMockService("service-2", "192.168.1.2"),
      createMockService("service-3", "192.168.1.3"),
    ];

    it("should select service with least connections", function () {
      const metrics = new Map([
        ["service-1", { ...DEFAULT_METRICS, activeConnections: 5 }],
        ["service-2", { ...DEFAULT_METRICS, activeConnections: 2 }],
        ["service-3", { ...DEFAULT_METRICS, activeConnections: 10 }],
      ]);

      const result = leastConnectionSelection(
        mockServices,
        metrics,
        DEFAULT_METRICS,
      );
      should(result.id).eql("service-2");
    });

    it("should use default metrics when service metrics not found", function () {
      const metrics = new Map([
        ["service-1", { ...DEFAULT_METRICS, activeConnections: 5 }],
      ]);

      const result = leastConnectionSelection(
        mockServices,
        metrics,
        DEFAULT_METRICS,
      );
      should(result.id).eql("service-2");
    });

    it("should throw error when no healthy services available", function () {
      const unhealthyServices = [
        createMockService("service-1", "192.168.1.1", 8080, "critical"),
      ];

      should(() =>
        leastConnectionSelection(unhealthyServices, new Map(), DEFAULT_METRICS),
      ).throw("No healthy services available");
    });
  });

  describe("weightedRandomSelection", function () {
    const mockRankedServices = [
      {
        score: 0.8,
        id: "service-1",
        service: createMockService("service-1", "192.168.1.1"),
      },
      {
        score: 0.5,
        id: "service-2",
        service: createMockService("service-2", "192.168.1.2"),
      },
    ];

    it("should select a service based on weighted random", function () {
      const result = weightedRandomSelection(mockRankedServices);
      should(["service-1", "service-2"]).containEql(result.id);
    });

    it("should return first service when total score is 0", function () {
      const zeroScoreServices = [
        { ...mockRankedServices[0], score: 0 },
        { ...mockRankedServices[1], score: 0 },
      ];

      const result = weightedRandomSelection(zeroScoreServices);
      should(result.id).eql("service-1");
    });

    it("should throw error when no services available", function () {
      should(() => weightedRandomSelection([])).throw(
        "No services available for selection",
      );
    });

    it("should favor higher scored services", function () {
      const highScoreServices = [
        { ...mockRankedServices[0], score: 100 },
        { ...mockRankedServices[1], score: 1 },
      ];

      const selections = [];
      for (let i = 0; i < 100; i++) {
        const result = weightedRandomSelection(highScoreServices);
        selections.push(result.id);
      }

      const service1Count = selections.filter(
        (id) => id === "service-1",
      ).length;
      should(service1Count).be.greaterThan(50);
    });
  });

  describe("roundRobinSrvSelection", function () {
    const mockRecords = [
      {
        name: "srv1.example.com",
        ip: "192.168.1.1",
        port: 8080,
        priority: 10,
        weight: 5,
      },
      {
        name: "srv2.example.com",
        ip: "192.168.1.2",
        port: 8080,
        priority: 10,
        weight: 5,
      },
      {
        name: "srv3.example.com",
        ip: "192.168.1.3",
        port: 8080,
        priority: 10,
        weight: 5,
      },
    ];

    it("should select records in round-robin order", function () {
      const result1 = roundRobinSrvSelection(mockRecords, 0);
      should(result1).not.be.null();
      should(result1.selected.ip).eql("192.168.1.1");
      should(result1.nextIndex).eql(1);

      const result2 = roundRobinSrvSelection(mockRecords, result1.nextIndex);
      should(result2).not.be.null();
      should(result2.selected.ip).eql("192.168.1.2");
      should(result2.nextIndex).eql(2);
    });

    it("should return null for empty records", function () {
      const result = roundRobinSrvSelection([], 0);
      should(result).be.null();
    });

    it("should wrap around to first record", function () {
      const result = roundRobinSrvSelection(mockRecords, 3);
      should(result).not.be.null();
      should(result.selected.ip).eql("192.168.1.1");
    });
  });

  describe("weightedSrvRecordSelection", function () {
    const mockRecords = [
      {
        name: "srv1.example.com",
        ip: "192.168.1.1",
        port: 8080,
        priority: 10,
        weight: 10,
      },
      {
        name: "srv2.example.com",
        ip: "192.168.1.2",
        port: 8080,
        priority: 10,
        weight: 5,
      },
      {
        name: "srv3.example.com",
        ip: "192.168.1.3",
        port: 8080,
        priority: 10,
        weight: 1,
      },
    ];

    it("should select records based on weight", function () {
      const result = weightedSrvRecordSelection(mockRecords, 0);
      should(result).not.be.null();
      should(["192.168.1.1", "192.168.1.2", "192.168.1.3"]).containEql(
        result.selected.ip,
      );
    });

    it("should fall back to round-robin when all weights are 0", function () {
      const zeroWeightRecords = [
        {
          name: "srv1.example.com",
          ip: "192.168.1.1",
          port: 8080,
          priority: 10,
          weight: 0,
        },
        {
          name: "srv2.example.com",
          ip: "192.168.1.2",
          port: 8080,
          priority: 10,
          weight: 0,
        },
      ];

      const result = weightedSrvRecordSelection(zeroWeightRecords, 0);
      should(result).not.be.null();
      should(result.selected.ip).eql("192.168.1.1");
      should(result.nextIndex).eql(1);
    });

    it("should return null for empty records", function () {
      const result = weightedSrvRecordSelection([], 0);
      should(result).be.null();
    });
  });
});
