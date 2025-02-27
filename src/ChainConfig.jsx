import { createPublicClient, http } from "viem";
import * as viemChains from "viem/chains";

import eulerChainsInterfaces from '../../euler-devland/libflat/euler-interfaces/EulerChains.json';
import eulerChainsDevLand from '../../euler-devland/dev-ctx/EulerChains.json';

export function getChainConfigs() {
    let chains = [ ...eulerChainsInterfaces, ...eulerChainsDevLand ];

    for (let chain of chains) {
        // FIXME: no need to override this when it's in addresses

        if (chain.chainId === 1) {
            chain.addresses.eulerSwapAddrs = {
                eulerSwapFactory: '0xFb9FE66472917F0F8966506A3bf831Ac0c10caD4',
                eulerSwapPeriphery: '0x52b26d9046BEc495914FaE467Ff0e95762C5ed74',
            };

            chain.addresses.maglevAddrs = {
                maglevLens: '0x23731d5b57f4199afd5080eaa9f22715df45d7c2',
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

        let chain = viemChains[chainName];
        if (config.status === 'testing') continue;
        if (!chain) throw Error(`no viem entry found for chain ${config.name}`);

        // FIXME: Figure out better solution for this than hard-coding

        if (chain.id === 1) {
            chain.rpcUrls.default.http[0] = 'https://necessary-newest-frost.quiknode.pro/de3ba1a355ccdea1bbf717fd359f36c2137f313f/';
        }

        chains.push(chain);
    }

    return chains;
}
