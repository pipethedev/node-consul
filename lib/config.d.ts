import { CommonOptions, Consul } from "./consul";

interface ConfigEntry {
  Kind: string;
  Name: string;
  Namespace?: string;
  Partition?: string;
  Meta?: Record<string, string>;
  CreateIndex?: number;
  ModifyIndex?: number;
  [key: string]: unknown;
}

interface ListOptions extends CommonOptions {
  kind: string;
}

type ListResult = ConfigEntry[];

interface GetOptions extends CommonOptions {
  kind: string;
  name: string;
}

type GetResult = ConfigEntry;

type SetOptions = CommonOptions;

type SetResult = boolean;

interface DestroyOptions extends CommonOptions {
  kind: string;
  name: string;
}

type DestroyResult = boolean;

declare class Config {
  constructor(consul: Consul);

  consul: Consul;

  list(options: ListOptions): Promise<ListResult>;
  list(kind: string): Promise<ListResult>;

  get(options: GetOptions): Promise<GetResult>;

  set(entry: ConfigEntry, options?: SetOptions): Promise<SetResult>;

  destroy(options: DestroyOptions): Promise<DestroyResult>;

  delete(options: DestroyOptions): Promise<DestroyResult>;
}

export { Config, ConfigEntry };
