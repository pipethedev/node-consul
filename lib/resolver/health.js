"use strict";

const { log } = require("@brimble/utils");

class HealthCheckManager {
  constructor(consul, redis, cachePrefix, cacheTTL, cacheEnabled, debug) {
    this.consul = consul;
    this.redis = redis;
    this.cachePrefix = cachePrefix;
    this.cacheTTL = cacheTTL;
    this.cacheEnabled = cacheEnabled;
    this.debug = debug;
  }

  getHealthCacheKey(service) {
    return `${this.cachePrefix}:health:${service}`;
  }

  async getHealthChecks(service) {
    const cacheKey = this.getHealthCacheKey(service);

    if (this.cacheEnabled) {
      const cachedHealth = await this.redis?.get(cacheKey);
      if (cachedHealth) {
        return JSON.parse(cachedHealth);
      }
    }

    try {
      const healthChecks = await this.consul.health.service(service);

      if (this.cacheEnabled) {
        await this.redis?.set(
          cacheKey,
          JSON.stringify(healthChecks),
          "EX",
          this.cacheTTL,
        );
      }

      return healthChecks;
    } catch (error) {
      if (this.debug) {
        log.error(`Error fetching health checks for ${service}:`, error);
      }
      return [];
    }
  }
}

exports.HealthCheckManager = HealthCheckManager;
