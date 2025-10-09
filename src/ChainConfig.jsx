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
        } else if (chain.chainId === 56) {
            chain.addresses.eulerSwapAddrs = {
                eulerSwapFactory: '0x3e378e5E339DF5e0Da32964F9EEC2CDb90D28Cc7',
                eulerSwapPeriphery: '0xa8826Bb29f875Db4c4b482463961776390774525',
            };

            chain.addresses.maglevAddrs = {
                maglevLens: '0x487554e593fD6Ac15F6D0ED3C3D84A599fdCD704',
            };
        } else if (chain.chainId === 130) {
            chain.addresses.eulerSwapAddrs = {
                eulerSwapFactory: '0x45b146BC07c9985589B52df651310e75C6BE066A',
                eulerSwapPeriphery: '0xdAAF468d84DD8945521Ea40297ce6c5EEfc7003a',
            };

            chain.addresses.maglevAddrs = {
                maglevLens: '0x1F5fDa12a026729e2635978324d2f98d839859f9',
            };
        } else if (chain.chainId === 9745) {
            chain.addresses.eulerSwapAddrs = {
                eulerSwapFactory: '0xD7aA03104c2CCaC58acB00CbE90865FA64BbE77D',
                eulerSwapPeriphery: '0x1472ebB000190275B5e28733e45a2614F1C3F41C',
            };

            chain.addresses.maglevAddrs = {
                maglevLens: '0x575734B8ADc00DfA2958d236fB3F14bCD171DEAf',
            };
        } else if (chain.chainId === 43114) {
            chain.addresses.eulerSwapAddrs = {
                eulerSwapFactory: '0x8A1D3a4850ed7deeC9003680Cf41b8E75D27e440',
                eulerSwapPeriphery: '0x31F34124a37f94efd17201A1B88d5008cD444c72',
            };

            chain.addresses.maglevAddrs = {
                maglevLens: '0xD43a8258549b77a4E55614648116e3a5923BAB0D',
            };
        } else if (chain.chainId === 59144) {
            chain.addresses.eulerSwapAddrs = {
                eulerSwapFactory: '0x970B065B572CC0118535Ad1101663CDBE7Db1e21',
                eulerSwapPeriphery: '0x0de305aB93902914909951A00079ea1df3FD98eA',
            };

            chain.addresses.maglevAddrs = {
                maglevLens: '0xf9600059c418e4b7f6a98015e419280851fd666a',
            };
        } else if (chain.chainId === 42161) {
            chain.addresses.eulerSwapAddrs = {
                eulerSwapFactory: '0x7949bE8B154D7B5ce6E75cBfc646AeF3a25970E2',
                eulerSwapPeriphery: '0x804485f5B6c293f8d63f697E9662CD4a8765858A',
            };

            chain.addresses.maglevAddrs = {
                maglevLens: '0x8dF44AC5Ea22aC99E90cdF3796A4C33bd55C9fEE',
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

        if (chain.id !== 31337) chain.rpcUrls.default.http[0] = `https://rpc2.euler.finance/maglev/evm/${chain.id}`;

        chains.push(chain);
    }

    return chains;
}
