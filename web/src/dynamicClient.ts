import { createDynamicClient } from "@dynamic-labs-sdk/client";
import { addEvmExtension } from "@dynamic-labs-sdk/evm";

export const dynamicClient = createDynamicClient({
  environmentId: import.meta.env.DYNAMIC_ENV_ID,
  metadata: { name: "benchmon", universalLink: window.location.origin },
});

addEvmExtension();
