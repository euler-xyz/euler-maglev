import { createPublicClient, http } from "viem";
import * as viemChains from "viem/chains";

import eulerChainsInterfaces from '../abis/chains/EulerChains.json';

let eulerChainsDevLand = [];

if (import.meta.env.DEV && import.meta.env.VITE_SKIP_DEVLAND !== 'true') {
    try {
        const path = '../../euler-devland/dev-ctx/EulerChains.json';
        eulerChainsDevLand = (await import(/* @vite-ignore */ path)).default;
    } catch (e) {
        console.warn('euler-devland not found, skipping devland chains');
    }
}


export function getChainConfigs() {
    let chains = [ ...eulerChainsInterfaces, ...eulerChainsDevLand, ];

    for (let chain of chains) {
        // FIXME: no need to override this when it's in addresses

        if (chain.chainId === 1) {
            chain.addresses.eulerSwapAddrs = {
                eulerSwapFactory: '0xD05213331221fAB8a3C387F2affBb605Bb04DF5F',
                eulerSwapRegistry: '0x5FcCB84363F020c0cADE052C9c654aABF932814A',
                eulerSwapPeriphery: '0xD3a349EE0A21eA0A7E9513ac236ae614b5FD513E',
            }

            chain.addresses.maglevAddrs = {
                maglevLens: '0x00cEcca22cA68480d4Ad22bb9C5Fb7F468179b8c',
            };
        } else if (chain.chainId === 143) {
            chain.addresses.eulerSwapAddrs = {
                eulerSwapFactory: '0x34f8f028c6a446a464c10a135f44fc6fb2cee1a9',
                eulerSwapPeriphery: '0xd1f69cf959c1a3aae7bee5ec677222d259585b27',
            };

            chain.addresses.maglevAddrs = {
                maglevLens: '0x4D8e0379cD91d904864c631C979A8F68e212E904',
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
