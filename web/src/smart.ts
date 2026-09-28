import type { WalletAccount } from "@dynamic-labs-sdk/client";

// same test the zerodev extension uses internally (isZerodevWalletAccount is not exported by the package)
export const isSmartAccount = (a: WalletAccount) => a.walletProviderKey.startsWith("zerodev");
