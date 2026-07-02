import { expectType } from "tsd";

import Consul from "../lib";

const consul = new Consul();

expectType<Consul>(consul);
expectType<Promise<boolean>>(
  consul.config.set({
    Kind: "service-resolver",
    Name: "salary-index-ng",
    Redirect: {
      Service: "6a3ea78d3d66fd3ab1dbbb12",
    },
  }),
);
expectType<
  Promise<{
    [key: string]: unknown;
    Kind: string;
    Name: string;
    Namespace?: string | undefined;
    Partition?: string | undefined;
    Meta?: Record<string, string> | undefined;
    CreateIndex?: number | undefined;
    ModifyIndex?: number | undefined;
  }>
>(
  consul.config.get({
    kind: "service-resolver",
    name: "salary-index-ng",
  }),
);
