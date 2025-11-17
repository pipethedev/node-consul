import { CommonOptions, Consul } from "./consul";

interface ListOptions extends CommonOptions {}

interface IntentionResult {
  ID: string;
  SourceName: string;
  DestinationName: string;
  SourceType?: string;
  Action: "allow" | "deny";
  Description?: string;
  Meta?: Record<string, string>;
  Precedence?: number;
  Permissions?: any[];
  CreateIndex?: number;
  ModifyIndex?: number;
}

type ListResult = IntentionResult[];

interface CreateOptions extends CommonOptions {
  sourcename: string;
  destinationname: string;
  action: "allow" | "deny";
  description?: string;
  sourcetype?: string;
  meta?: Record<string, string>;
  precedence?: number;
  permissions?: any[];
}

interface CreateResult {
  ID: string;
}

interface GetOptions extends CommonOptions {
  id: string;
}

type GetResult = IntentionResult;

interface UpdateOptions extends CreateOptions {
  id: string;
}

type UpdateResult = boolean;

interface DestroyOptions extends CommonOptions {
  id: string;
}

type DestroyResult = boolean;

declare class Intention {
  constructor(consul: Consul);

  consul: Consul;

  list(options?: ListOptions): Promise<ListResult>;

  create(options: CreateOptions): Promise<CreateResult>;

  get(options: GetOptions): Promise<GetResult>;
  get(id: string): Promise<GetResult>;

  update(options: UpdateOptions): Promise<UpdateResult>;

  destroy(options: DestroyOptions): Promise<DestroyResult>;
  destroy(id: string): Promise<DestroyResult>;

  delete(options: DestroyOptions): Promise<DestroyResult>;
  delete(id: string): Promise<DestroyResult>;
}
