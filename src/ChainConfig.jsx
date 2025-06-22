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

        if (chain.chainId === 1) {
            chain.addresses.eulerSwapAddrs = {
                eulerSwapFactory: '0xb013be1D0D380C13B58e889f412895970A2Cf228',
                eulerSwapPeriphery: '0x208fF5Eb543814789321DaA1B5Eb551881D16b06',
            };

            chain.addresses.maglevAddrs = {
                maglevLens: '0xb4876B74638F417Fa620B6169cdf7690351441fE',
            };
        } else if (chain.chainId === 130) {
            chain.addresses.eulerSwapAddrs = {
                eulerSwapFactory: '0x45b146BC07c9985589B52df651310e75C6BE066A',
                eulerSwapPeriphery: '0xdAAF468d84DD8945521Ea40297ce6c5EEfc7003a',
            };

            chain.addresses.maglevAddrs = {
                maglevLens: '0x1F5fDa12a026729e2635978324d2f98d839859f9',
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
            chain.rpcUrls.default.http[0] = 'https://lb.drpc.org/ogrpc?network=ethereum&dkey=AqqUmy43EUMFg-KecrSxzlod45SCPT4R8I63FuhS1q00';
        } else if (chain.id === 130) {
            chain.rpcUrls.default.http[0] = 'https://lb.drpc.org/ogrpc?network=unichain&dkey=AqqUmy43EUMFg-KecrSxzlod45SCPT4R8I63FuhS1q00';
        }

        chains.push(chain);
    }

    return chains;
}
