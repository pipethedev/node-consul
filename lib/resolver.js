"use strict";

const { log } = require("@brimble/utils");
const {
  leastConnectionSelection,
  roundRobinSelection,
  weightedRandomSelection,
} = require("./resolver/algorithms");
const { DNSManager } = require("./resolver/dns");
const { HealthCheckManager } = require("./resolver/health");
const { MetricsManager } = require("./resolver/metrics");
const {
  combineHealthAndDNSWeights,
  rankServices,
} = require("./resolver/scoring");
const {
  DEFAULT_METRICS,
  DEFAULT_WEIGHTS,
  SelectionAlgorithm,
} = require("./resolver/types");

class Resolver {
  constructor(consul, config) {
    this.consul = consul;
    this.currentIndex = 0;
    this.debug = config.debug || false;
    this.cachePrefix = config.cachePrefix;
    this.cacheEnabled = config.cacheEnabled;
    this.weights = config.weights || DEFAULT_WEIGHTS;
    this.metrics = config.metrics || DEFAULT_METRICS;
    this.redis = config.redis;

    this.cacheTTL = Math.floor((config.cacheTTL || 60 * 1000) / 1000);

    if (this.cacheEnabled && config.redis) {
      this.redis = config.redis;
      this.cacheEnabled = true;
    }

    this.metricsManager = new MetricsManager(
      this.redis,
      this.cachePrefix,
      this.metrics,
      this.cacheEnabled,
      this.debug,
    );

    this.dnsManager = new DNSManager(
      this.redis,
      this.cachePrefix,
      this.cacheTTL,
      this.cacheEnabled,
      this.debug,
      config.dnsEndpoints,
      config.dnsTimeout,
      config.dnsRetries,
    );

    this.healthCheckManager = new HealthCheckManager(
      this.consul,
      this.redis,
      this.cachePrefix,
      this.cacheTTL,
      this.cacheEnabled,
      this.debug,
    );
  }

  /**
   * Select the optimal service based on the specified algorithm
   */
  async selectOptimalService(
    service,
    algorithm = SelectionAlgorithm.RoundRobin,
  ) {
    try {
      const [healthChecks, dnsRecords] = await Promise.all([
        this.healthCheckManager.getHealthChecks(service),
        this.dnsManager.resolveDNS(service),
      ]);

      if (
        (!healthChecks || healthChecks.length === 0) &&
        dnsRecords.length === 0
      ) {
        return { selected: null, services: [] };
      }

      const sortedByPriority = this.dnsManager.sortByPriority(dnsRecords);

      const lowestPriorityValue = sortedByPriority[0]?.priority;
      const highestPriorityRecords = sortedByPriority.filter(
        (record) => record.priority === lowestPriorityValue,
      );

      if (!healthChecks || healthChecks.length === 0) {
        const { selected, nextIndex } = this.dnsManager.selectFromSrvRecords(
          highestPriorityRecords,
          algorithm,
          this.currentIndex,
        );
        this.currentIndex = nextIndex;

        if (!selected) {
          return { selected: null, services: [] };
        }

        await this.metricsManager.updateSelectionMetrics(selected.name);

        return {
          selected: {
            ip: selected.ip,
            port: selected.port,
          },
          services: sortedByPriority.map((record) => ({
            ip: record.ip,
            port: record.port,
          })),
        };
      }

      const dnsWeights = new Map(
        dnsRecords.map((record) => [
          record.ip,
          {
            weight: record.weight,
            port: record.port,
            priority: record.priority,
          },
        ]),
      );

      const matchedHealthChecks = healthChecks.filter((check) =>
        dnsWeights.has(check.Service.Address),
      );

      if (matchedHealthChecks.length === 0) {
        if (this.debug) {
          log.debug(
            "No matching services found between DNS and Consul health checks",
          );
        }
        const { selected, nextIndex } = this.dnsManager.selectFromSrvRecords(
          highestPriorityRecords,
          algorithm,
          this.currentIndex,
        );
        this.currentIndex = nextIndex;

        if (!selected) {
          return { selected: null, services: [] };
        }

        await this.metricsManager.updateSelectionMetrics(selected.name);

        return {
          selected: {
            ip: selected.ip,
            port: selected.port,
          },
          services: sortedByPriority.map((record) => ({
            ip: record.ip,
            port: record.port,
          })),
        };
      }

      const highPriorityIPs = new Set(
        highestPriorityRecords.map((record) => record.ip),
      );
      const highPriorityHealthChecks = matchedHealthChecks.filter((check) =>
        highPriorityIPs.has(check.Service.Address),
      );

      const targetHealthChecks =
        highPriorityHealthChecks.length > 0
          ? highPriorityHealthChecks
          : matchedHealthChecks;

      const maxDNSWeight = Math.max(...dnsRecords.map((r) => r.weight || 1));

      const enhancedHealthChecks = targetHealthChecks.map((check) => ({
        ...check,
        dnsWeight: combineHealthAndDNSWeights(
          check,
          dnsWeights.get(check.Service.Address)?.weight || 0,
          maxDNSWeight,
        ),
      }));

      const metrics =
        await this.metricsManager.getServicesMetrics(targetHealthChecks);
      let selectedService;

      switch (algorithm) {
        case SelectionAlgorithm.RoundRobin: {
          const rrResult = roundRobinSelection(
            enhancedHealthChecks,
            this.currentIndex,
          );
          this.currentIndex = rrResult.nextIndex;
          selectedService = { id: rrResult.id, service: rrResult.service };
          break;
        }
        case SelectionAlgorithm.LeastConnection:
          selectedService = leastConnectionSelection(
            enhancedHealthChecks,
            metrics,
            this.metrics,
          );
          break;
        case SelectionAlgorithm.WeightedRoundRobin: {
          const rankedServices = rankServices(
            enhancedHealthChecks,
            metrics,
            this.weights,
          );
          rankedServices.forEach((ranked) => {
            const dnsInfo = dnsWeights.get(ranked.service.Service.Address);
            if (dnsInfo) {
              ranked.score *= 1 + dnsInfo.weight / maxDNSWeight;
            }
          });
          selectedService = weightedRandomSelection(rankedServices);
          break;
        }
      }

      await this.metricsManager.updateSelectionMetrics(selectedService.id);

      const selectedDNSInfo = dnsWeights.get(
        selectedService.service.Service.Address,
      );

      return {
        selected: {
          ip: selectedService.service.Service.Address,
          port: selectedDNSInfo?.port || selectedService.service.Service.Port,
        },
        services: matchedHealthChecks.map((check) => {
          const dnsInfo = dnsWeights.get(check.Service.Address);
          return {
            ip: check.Service.Address,
            port: dnsInfo?.port || check.Service.Port,
          };
        }),
      };
    } catch (error) {
      if (this.debug) {
        log.error("Error selecting optimal service:", error);
      }
      return { selected: null, services: [] };
    }
  }

  async incrementConnections(serviceId) {
    return this.metricsManager.incrementConnections(serviceId);
  }

  async decrementConnections(serviceId) {
    return this.metricsManager.decrementConnections(serviceId);
  }

  async getSelectionMetrics(serviceId) {
    return this.metricsManager.getSelectionMetrics(serviceId);
  }

  async refresh() {
    try {
      if (!this.cacheEnabled) {
        if (this.debug) {
          log.debug("Cache is disabled, no need to refresh");
        }
        return;
      }
      const pattern = `${this.cachePrefix}:*`;
      const keys = await this.redis?.keys(pattern);

      if (keys && keys.length > 0) {
        await this.redis?.del(...keys);
      }
    } catch (error) {
      console.log("Error refreshing Redis caches:", error);
      throw new Error(`Failed to refresh caches: ${error.message}`);
    }
  }
}

exports.Resolver = Resolver;
exports.SelectionAlgorithm = SelectionAlgorithm;
