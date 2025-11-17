"use strict";

const DEFAULT_WEIGHTS = {
  health: 0.25,
  responseTime: 0.2,
  errorRate: 0.2,
  resources: 0.15,
  connections: 0.1,
  distribution: 0.1,
};

const DEFAULT_METRICS = {
  responseTime: 100,
  errorRate: 0,
  cpuUsage: 50,
  memoryUsage: 50,
  activeConnections: 0,
};

const SelectionAlgorithm = {
  RoundRobin: "round-robin",
  LeastConnection: "least-connection",
  WeightedRoundRobin: "weighted-round-robin",
};

exports.DEFAULT_WEIGHTS = DEFAULT_WEIGHTS;
exports.DEFAULT_METRICS = DEFAULT_METRICS;
exports.SelectionAlgorithm = SelectionAlgorithm;
