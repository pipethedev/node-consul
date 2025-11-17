"use strict";

const { DEFAULT_WEIGHTS } = require("./types");

function calculateHealthScore(service) {
  const checks = service.Checks;
  const totalChecks = checks.length;
  if (totalChecks === 0) return 0;

  const passingChecks = checks.filter(
    (check) => check.Status === "passing",
  ).length;
  return passingChecks / totalChecks;
}

function normalizeScore(value, max, inverse = false) {
  const normalized = Math.max(0, Math.min(1, value / max));
  return inverse ? 1 - normalized : normalized;
}

function calculateResourceScore(metrics) {
  const cpuScore = normalizeScore(metrics.cpuUsage, 100, true);
  const memoryScore = normalizeScore(metrics.memoryUsage, 100, true);
  return (cpuScore + memoryScore) / 2;
}

function calculateDistributionScore(lastSelectedTime) {
  if (!lastSelectedTime) return 1;

  const timeSinceLastSelection = Date.now() - lastSelectedTime;

  return Math.min(timeSinceLastSelection / (5 * 60 * 1000), 1);
}

function rankServices(services, metrics, weights = DEFAULT_WEIGHTS) {
  return services
    .map((service) => {
      const serviceId = service.Service.ID;

      const serviceMetrics = metrics.get(serviceId);

      if (!serviceMetrics) {
        throw new Error(`No metrics found for service ${serviceId}`);
      }

      const healthScore = calculateHealthScore(service);
      const responseTimeScore = normalizeScore(
        serviceMetrics.responseTime,
        500,
        true,
      );
      const errorRateScore = normalizeScore(
        serviceMetrics.errorRate,
        100,
        true,
      );
      const resourceScore = calculateResourceScore(serviceMetrics);
      const connectionScore = normalizeScore(
        serviceMetrics.activeConnections,
        1000,
        true,
      );
      const distributionScore = calculateDistributionScore(
        serviceMetrics.lastSelectedTime,
      );

      const totalScore =
        healthScore * weights.health +
        responseTimeScore * weights.responseTime +
        errorRateScore * weights.errorRate +
        resourceScore * weights.resources +
        connectionScore * weights.connections +
        distributionScore * weights.distribution;

      return {
        score: totalScore,
        id: serviceId,
        service,
      };
    })
    .sort((a, b) => b.score - a.score);
}

function combineHealthAndDNSWeights(service, dnsWeight, maxDNSWeight) {
  const healthScore = calculateHealthScore(service);
  const normalizedDNSWeight = dnsWeight / maxDNSWeight;
  return healthScore * 0.7 + normalizedDNSWeight * 0.3;
}

exports.calculateHealthScore = calculateHealthScore;
exports.calculateResourceScore = calculateResourceScore;
exports.calculateDistributionScore = calculateDistributionScore;
exports.normalizeScore = normalizeScore;
exports.rankServices = rankServices;
exports.combineHealthAndDNSWeights = combineHealthAndDNSWeights;
