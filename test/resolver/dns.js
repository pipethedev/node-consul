"use strict";

const should = require("should");
const RedisMock = require("ioredis-mock");
const { DNSManager } = require("../../lib/resolver/dns");
const { SelectionAlgorithm } = require("../../lib/resolver/types");

describe("Resolver DNS", function () {
  let redis;
  let dnsManager;

  beforeEach(function () {
    redis = new RedisMock();
    dnsManager = new DNSManager(
      redis,
      "test-consul",
      60,
      true,
      false,
      undefined,
      undefined,
      undefined,
    );
  });

  afterEach(async function () {
    await redis.flushall();
    redis.disconnect();
  });

  describe("resolveDNS", function () {
    it("should return cached DNS results", async function () {
      const cachedRecords = [
        {
          name: "srv1.example.com",
          ip: "192.168.1.1",
          port: 8080,
          priority: 10,
          weight: 5,
        },
      ];

      await redis.set(
        "test-consul:dns:test-service",
        JSON.stringify(cachedRecords),
        "EX",
        60,
      );

      const result = await dnsManager.resolveDNS("test-service");
      should(result).eql(cachedRecords);
    });

    it("should return empty array when cache miss and no DNS", async function () {
      // Mock the query function by stubbing it
      const dnsQuery = require("dns-query");
      const originalQuery = dnsQuery.query;

      dnsQuery.query = async () => ({
        answers: [],
        additionals: [],
      });

      const result = await dnsManager.resolveDNS("nonexistent-service");
      should(result).eql([]);

      dnsQuery.query = originalQuery;
    });
  });

  describe("sortByPriority", function () {
    it("should sort records by priority", function () {
      const records = [
        { priority: 20, ip: "192.168.1.2", port: 8080 },
        { priority: 10, ip: "192.168.1.1", port: 8080 },
        { priority: 15, ip: "192.168.1.3", port: 8080 },
      ];

      const sorted = dnsManager.sortByPriority(records);
      should(sorted[0].priority).eql(10);
      should(sorted[1].priority).eql(15);
      should(sorted[2].priority).eql(20);
    });
  });

  describe("selectFromSrvRecords", function () {
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
    ];

    it("should select using round robin", function () {
      const result = dnsManager.selectFromSrvRecords(
        mockRecords,
        SelectionAlgorithm.RoundRobin,
        0,
      );
      should(result.selected).not.be.null();
      should(result.selected.ip).eql("192.168.1.1");
    });

    it("should select using weighted round robin", function () {
      const result = dnsManager.selectFromSrvRecords(
        mockRecords,
        SelectionAlgorithm.WeightedRoundRobin,
        0,
      );
      should(result.selected).not.be.null();
      should(["192.168.1.1", "192.168.1.2"]).containEql(result.selected.ip);
    });

    it("should return null for empty records", function () {
      const result = dnsManager.selectFromSrvRecords(
        [],
        SelectionAlgorithm.RoundRobin,
        0,
      );
      should(result.selected).be.null();
    });
  });
});
