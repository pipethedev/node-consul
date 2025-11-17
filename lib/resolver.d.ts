import { Agent as httpAgent } from "http";
import { Agent as httpsAgent } from "https";
import { Redis as IORedis } from "ioredis";
import { Consul } from "./consul";

export interface ConsulResolverConfig {
  redis?: IORedis;
  cacheEnabled: boolean;
  cachePrefix: string;
  debug?: boolean;
  weights?: {
    health: number;
    responseTime: number;
    errorRate: number;
    resources: number;
    connections: number;
    distribution: number;
  };
  metrics?: {
    responseTime: number;
    errorRate: number;
    cpuUsage: number;
    memoryUsage: number;
    activeConnections: number;
  };
  cacheTTL?: number;
  dnsEndpoints?: string[];
  dnsTimeout?: number;
  dnsRetries?: number;
}

export interface ServiceInfo {
  ip: string;
  port: number;
}

export interface OptimalServiceResult {
  selected: ServiceInfo | null;
  services: ServiceInfo[];
}

export interface ServiceMetrics {
  responseTime: number;
  errorRate: number;
  cpuUsage: number;
  memoryUsage: number;
  activeConnections: number;
  lastSelectedTime?: number;
}

export enum SelectionAlgorithm {
  RoundRobin = "round-robin",
  LeastConnection = "least-connection",
  WeightedRoundRobin = "weighted-round-robin",
}

declare class Resolver {
  constructor(consul: Consul, config: ConsulResolverConfig);

  consul: Consul;

  selectOptimalService(
    service: string,
    algorithm?: SelectionAlgorithm,
  ): Promise<OptimalServiceResult>;

  incrementConnections(serviceId: string): Promise<void>;

  decrementConnections(serviceId: string): Promise<void>;

  getSelectionMetrics(serviceId: string): Promise<ServiceMetrics | null>;

  refresh(): Promise<void>;
}

export { Resolver };
