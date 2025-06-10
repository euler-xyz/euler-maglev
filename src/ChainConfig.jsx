import { createPublicClient, http } from "viem";
import * as viemChains from "viem/chains";

import eulerChainsInterfaces from '../abis/EulerChains.json';

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
            // FIXME: these are addresses for ES 0.9

            chain.addresses.eulerSwapAddrs = {
                eulerSwapFactory: '0xFb9FE66472917F0F8966506A3bf831Ac0c10caD4',
                eulerSwapPeriphery: '0x52b26d9046BEc495914FaE467Ff0e95762C5ed74',
            };

            chain.addresses.maglevAddrs = {
                maglevLens: '0x23731d5b57f4199afd5080eaa9f22715df45d7c2',
            };
        } else if (chain.chainId === 130) {
            chain.addresses.eulerSwapAddrs = {
                eulerSwapFactory: '0x45b146BC07c9985589B52df651310e75C6BE066A',
                eulerSwapPeriphery: '0xdAAF468d84DD8945521Ea40297ce6c5EEfc7003a',
            };

            chain.addresses.maglevAddrs = {
                maglevLens: '0x6a0728d2e8E3cE22800047BDB5BbD67261813309',
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
