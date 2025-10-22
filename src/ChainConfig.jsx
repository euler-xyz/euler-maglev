import { createPublicClient, http } from "viem";
import * as viemChains from "viem/chains";

import eulerChainsInterfaces from '../abis/chains/EulerChains.json';

let eulerChainsDevLand;

if (import.meta.env.DEV) {
    eulerChainsDevLand = (await import('../../euler-devland/dev-ctx/EulerChains.json')).default;
} else {
    eulerChainsDevLand = [];
}


export function getChainConfigs() {
    let chains = [ ...eulerChainsInterfaces, ...eulerChainsDevLand, ];

    for (let chain of chains) {
        // FIXME: no need to override this when it's in addresses

        if (chain.chainId === 8453) {
            chain.addresses.eulerSwapAddrs = {
                eulerSwapFactory: '0xd7c9ec4925e5d95d341a169e8d7275e92b064b74',
                eulerSwapRegistry: '0x93c4d4909fdc3b0651374f1160ec2aed4960d82c',
                eulerSwapPeriphery: '0x18f0e5f802937447f49ea5e8faebb454c5c74c71',
            };

            chain.addresses.maglevAddrs = {
                maglevLens: '0x9deEF5F10a34963d63bDaF47Ec1e59Fd19A594Dd',
            };
        }
    }

    return chains;
}

export function getWagmiChainConfigs() {
    let chains = [];

    for (let config of getChainConfigs()) {
        let chainName = config.viemName || config.name;
        if (chainName === 'dev') chainName = 'foundry';

        if (config.status === 'testing') continue;
        if (config.chainId === 999) continue; // HyperVM has incorrect viem entry, ignore for now

        let chain = Object.values(viemChains).find(chain => chain.id == config.chainId);
        if (!chain) throw Error(`no viem entry found for chain ${config.name}`);

        if (chain.id !== 31337) chain.rpcUrls.default.http[0] = `https://rpc2.euler.finance/maglev/evm/${chain.id}`;

        chains.push(chain);
    }

    return chains;
}
