import { Consul, SelectionAlgorithm } from "./consul";
import {
  ConsulResolverConfig,
  ServiceInfo,
  OptimalServiceResult,
  ServiceMetrics,
  Resolver,
} from "./resolver";

export = Consul;

export type {
  ConsulResolverConfig,
  ServiceInfo,
  OptimalServiceResult,
  ServiceMetrics,
};
export { SelectionAlgorithm, Resolver };
