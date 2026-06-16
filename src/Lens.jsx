import { useQuery } from "@tanstack/react-query";
import { getAddress, parseUnits, formatUnits, parseAbi } from "viem";
import { usePublicClient, useChainId } from 'wagmi';

import { getChainConfigs } from './ChainConfig';
import * as Utils from './Utils';
import { getErrorHandlingOptions } from './ErrorBoundary';

import maglevLensAbi from '../abis/MaglevLens.json';

let products31337;
let prices31337;

if (import.meta.env.DEV && import.meta.env.VITE_SKIP_DEVLAND !== 'true') {
    try {
        const productsPath = '../../euler-devland/dev-ctx/labels/31337/products.json';
        const pricesPath = '../../euler-devland/dev-ctx/priceapi/31337/prices.json';
        products31337 = (await import(/* @vite-ignore */ productsPath)).default;
        prices31337 = (await import(/* @vite-ignore */ pricesPath)).default;
    } catch (e) {
        console.warn('euler-devland not found, skipping devland data');
    }
}





const mask16 = 2n ** 16n - 1n;
const mask48 = 2n ** 48n - 1n;
const mask112 = 2n ** 112n - 1n;



export function useEulerChain() {
    let myChainId = useChainId();

    return useQuery({
        queryKey: ['maglev-euler-chains'],
        staleTime: Infinity,
        queryFn: async () => {
            let lookup = {};

            for (let c of getChainConfigs()) {
                lookup[c.chainId] = c;
            }

            return lookup;
        },
        select: (data) => data[myChainId],
    });
}


export function useLabels() {
    let myChainId = useChainId();

    return useQuery({
        queryKey: ['maglev-labels', myChainId],
        staleTime: Infinity,
        queryFn: async () => {
            let orig = {};

            if (myChainId === 31337) orig[31337] = products31337;
            else {
                let response = await fetch(`https://raw.githubusercontent.com/euler-xyz/euler-labels/refs/heads/master/${myChainId}/products.json`);
                orig[myChainId] = await response.json();
            }

            let output = {};

            for (let chainId of Object.keys(orig)) {
                output[chainId] = { vaults: {}, raw: orig[chainId], };
                for (let product of Object.keys(orig[chainId])) {
                    for (let vault of orig[chainId][product].vaults) {
                        output[chainId].vaults[vault] = product;
                    }
                }
            }

            return output;
        },
        select: (data) => data[myChainId],
    });
}



export function usePrices() {
    let myChainId = useChainId();

    return useQuery({
        queryKey: ['maglev-prices', myChainId],
        staleTime: Infinity,
        queryFn: async () => {
            if (myChainId === 31337) return { 31337: prices31337, };

            let response = await fetch(`https://indexer.euler.finance/v1/prices?chainId=${myChainId}`);
            let json = await response.json();
            return { [myChainId]: json, };
        },
        select: (data) => data[myChainId],
    });
}

function decodeVaultStaticInfo(r, vault) {
    return {
        asset: getAddress(r.substr(0, 42)),
        decimals: parseInt(r.substr(42, 2), 16),
        symbol: Utils.utf8Decode(Utils.hex2a(r.substr(44))),
        vault,
    };
}

export function useVaultsStaticInfo(vaultAddrs) {
    let { data: currChain, isPending: pending1 } = useEulerChain();
    let client = usePublicClient();

    return useQuery({
        queryKey: ['maglev-vaults-static', currChain?.chainId, vaultAddrs],
        staleTime: Infinity,
        enabled: !pending1 && vaultAddrs !== undefined,
        queryFn: async () => {
            if (vaultAddrs.length === 0) return {};

            let raw = await client.readContract({
                address: currChain.addresses.maglevAddrs.maglevLens,
                abi: maglevLensAbi.abi,
                functionName: 'vaultsStatic',
                args: [vaultAddrs],
            });

            let output = {};

            for (let i = 0; i < vaultAddrs.length; i++) {
                let vaultAddr = vaultAddrs[i];
                output[vaultAddr] = decodeVaultStaticInfo(raw[i], vaultAddr);
            }

            return output;
        },
    });
}



function decodeVaultGlobal(r) {
    let o = {
        cash: r.packed1 >> (112n + 16n + 16n),
        borrows: (r.packed1 >> (16n + 16n)) & mask112,
        supplyCap: (r.packed1 >> 16n) & mask16,
        borrowCap: r.packed1 & mask16,

        shares: r.packed2 >> (48n + 48n),
        supplyAPY: (r.packed2 >> 48n) & mask48,
        borrowAPY: r.packed2 & mask48,
    };

    o.assets = o.cash + o.borrows;

    return o;
}

export function useVaultsGlobal(vaultAddrs) {
    let { data: currChain, isPending: pending1 } = useEulerChain();
    let client = usePublicClient();

    return useQuery({
        queryKey: ['maglev-vaults-global', currChain?.chainId, vaultAddrs],
        staleTime: 60 * 1000,
        enabled: !pending1 && vaultAddrs !== undefined,
        ...getErrorHandlingOptions('useVaultsGlobal'),
        queryFn: async () => {
            if (vaultAddrs.length === 0) return {};

            // Read each vault separately via multicall with allowFailure so that
            // a single unsupported vault (e.g. a collateral-only vault that has no
            // borrow/APY state and reverts) doesn't take down the whole batch.
            let results = await client.multicall({
                contracts: vaultAddrs.map(vault => ({
                    address: currChain.addresses.maglevAddrs.maglevLens,
                    abi: maglevLensAbi.abi,
                    functionName: 'vaultsGlobal',
                    args: [[vault]],
                })),
                allowFailure: true,
            });

            let output = {};

            for (let i = 0; i < vaultAddrs.length; i++) {
                if (results[i].status !== 'success') continue;
                output[vaultAddrs[i]] = decodeVaultGlobal(results[i].result[0]);
            }

            return output;
        },
    });
}

export function useVaultsDetailed(vaultAddrs) {
    let { data: currChain, isPending: pending1 } = useEulerChain();
    let client = usePublicClient();

    return useQuery({
        queryKey: ['maglev-vaults-detailed', currChain?.chainId, vaultAddrs],
        staleTime: 60 * 1000,
        enabled: !pending1 && vaultAddrs !== undefined,
        ...getErrorHandlingOptions('useVaultsDetailed'),
        queryFn: async () => {
            if (vaultAddrs.length === 0) return {};

            let raw = await client.readContract({
                address: currChain.addresses.maglevAddrs.maglevLens,
                abi: maglevLensAbi.abi,
                functionName: 'vaultsDetailed',
                args: [vaultAddrs],
            });

            return raw;
        },
    });
}



export function useLTVMatrix(vaults, liquidationLtv) {
    let { data: currChain, isPending: pending1 } = useEulerChain();
    let client = usePublicClient();

    return useQuery({
        queryKey: ['maglev-ltv-matrix', vaults, liquidationLtv],
        staleTime: 60 * 1000,
        enabled: vaults && !pending1,
        ...getErrorHandlingOptions('useLTVMatrix'),
        queryFn: async () => {
            let raw = await client.readContract({
                address: currChain.addresses.maglevAddrs.maglevLens,
                abi: maglevLensAbi.abi,
                functionName: 'getLTVMatrix',
                args: [vaults, liquidationLtv],
            });

            let output = raw.map(v => v / 1e4);
            let outputMatrix = [];
            while (output.length) outputMatrix.push(output.splice(0, vaults.length));

            return outputMatrix;
        },
    });
}




function decodeVaultsPersonalInfo(me, subAccountBitmask, vaultAddrs, raw) {
    let output = {};

    for (let i = 0; i < 256; i++) {
        if ((subAccountBitmask & (1n << BigInt(i))) === 0n) continue;

        output[i] = {};
        for (let j = 0; j < vaultAddrs.length; j++) {
            let r = raw.shift();

            output[i][vaultAddrs[j]] = {
                balance: (r.packed >> 112n) & mask112,
                debt: r.packed & mask112,
                collateral: ((r.packed >> 224n) & 1n) === 1n,
                controller: ((r.packed >> 225n) & 1n) === 1n,
            };
        }
    }

    return output;
}

// Read personal state for each vault separately via multicall with allowFailure,
// so a single unsupported vault (one that reverts in vaultsPersonalState, e.g. a
// collateral-only vault) doesn't take down the whole batch. Vaults that revert are
// simply omitted from the returned per-subaccount maps; callers must tolerate a
// missing vault entry. The output shape matches decodeVaultsPersonalInfo: an object
// keyed by subaccount id, each an object keyed by vault address.
async function readVaultsPersonalState(client, currChain, me, subAccountBitmask, vaultAddrs) {
    // Seed every requested subaccount so callers can always iterate the masks.
    let output = {};
    for (let i = 0; i < 256; i++) {
        if ((subAccountBitmask & (1n << BigInt(i))) !== 0n) output[i] = {};
    }

    if (vaultAddrs.length === 0) return output;

    let results = await client.multicall({
        contracts: vaultAddrs.map(vault => ({
            address: currChain.addresses.maglevAddrs.maglevLens,
            abi: maglevLensAbi.abi,
            functionName: 'vaultsPersonalState',
            args: [currChain.addresses.coreAddrs.evc, me, subAccountBitmask, [vault]],
        })),
        allowFailure: true,
    });

    for (let i = 0; i < vaultAddrs.length; i++) {
        if (results[i].status !== 'success') continue;
        let decoded = decodeVaultsPersonalInfo(me, subAccountBitmask, [vaultAddrs[i]], [...results[i].result]);
        for (let subId of Object.keys(decoded)) {
            output[subId][vaultAddrs[i]] = decoded[subId][vaultAddrs[i]];
        }
    }

    return output;
}

export function useVaultsPersonalInfo(me, vaultAddrs) {
    let { data: currChain, isPending: pending1 } = useEulerChain();
    let client = usePublicClient();

    return useQuery({
        queryKey: ['maglev-vaults-personal', currChain?.chainId, me, vaultAddrs],
        staleTime: 60 * 1000,
        enabled: !!me && !pending1 && vaultAddrs !== undefined,
        ...getErrorHandlingOptions('useVaultsPersonalInfo'),
        queryFn: async () => {
            let output = await readVaultsPersonalState(client, currChain, me, 1n, vaultAddrs);
            return output[0];
        },
    });
}

export function useVaultsPersonalInfoMulti(me, subAccountBitmask, vaultAddrs) {
    let { data: currChain, isPending: pending1 } = useEulerChain();
    let client = usePublicClient();

    return useQuery({
        queryKey: ['maglev-vaults-personal-multi', currChain?.chainId, me, subAccountBitmask.toString(), vaultAddrs],
        staleTime: 60 * 1000,
        enabled: !!me && !pending1 && vaultAddrs !== undefined,
        ...getErrorHandlingOptions('useVaultsPersonalInfoMulti'),
        queryFn: async () => {
            return await readVaultsPersonalState(client, currChain, me, subAccountBitmask, vaultAddrs);
        },
    });
}

export function useMyEnteredMarkets(me) {
    let { data: currChain, isPending: pending1 } = useEulerChain();
    let client = usePublicClient();

    return useQuery({
        queryKey: ['maglev-myEnteredMarkets', me],
        staleTime: 60 * 1000,
        enabled: !pending1,
        ...getErrorHandlingOptions('useMyEnteredMarkets'),
        queryFn: async () => {
            let raw = await client.readContract({
                address: currChain.addresses.maglevAddrs.maglevLens,
                abi: maglevLensAbi.abi,
                functionName: 'myEnteredMarkets',
                args: [currChain.addresses.coreAddrs.evc, me],
            });

            return { collaterals: raw[0], controllers: raw[1], };
        },
    });
}




export function useMyEulerSwap(myAddr) {
    let { data: currChain, isPending: pending1 } = useEulerChain();
    let client = usePublicClient();

    return useQuery({
        queryKey: ['maglev-eulerSwap', 'my', currChain?.chainId, myAddr],
        staleTime: 60 * 1000,
        enabled: !!myAddr && !pending1 && !!currChain?.addresses.eulerSwapAddrs,
        ...getErrorHandlingOptions('useMyEulerSwap'),
        queryFn: async () => {
            let raw = await client.readContract({
                address: currChain.addresses.maglevAddrs.maglevLens,
                abi: maglevLensAbi.abi,
                functionName: 'getMyEulerSwap',
                args: [currChain.addresses.eulerSwapAddrs.eulerSwapFactory, myAddr],
            });

            return raw;
        },
    });
}


export function useEulerSwapData() {
    let { data: currChain, isPending: pending1 } = useEulerChain();
    let client = usePublicClient();

    return useQuery({
        queryKey: ['maglev-eulerSwap', 'data', currChain?.chainId],
        staleTime: 60 * 1000,
        enabled: !pending1 && !!currChain?.addresses.eulerSwapAddrs,
        ...getErrorHandlingOptions('useEulerSwapData'),
        queryFn: async () => {
            let raw = await client.readContract({
                address: currChain.addresses.maglevAddrs.maglevLens,
                abi: maglevLensAbi.abi,
                functionName: 'getEulerSwaps',
                args: [currChain.addresses.eulerSwapAddrs.eulerSwapFactory],
            });

            return raw;
        },
    });
}

export function useEulerSwapQuoteMulti(ctx, eulerSwaps, tokenIn, tokenOut, amount, exactIn) {
    let { data: currChain, isPending: pending1 } = useEulerChain();
    let client = usePublicClient();

    if (ctx.knownAssets) {
        tokenIn = ctx.knownAssets[tokenIn]?.addr;
        tokenOut = ctx.knownAssets[tokenOut]?.addr;
    }

    let enabled = !!(!pending1 && currChain?.addresses.eulerSwapAddrs && eulerSwaps && tokenIn && tokenOut && amount);

    return useQuery({
        queryKey: ['maglev-eulerSwap', 'quoteMulti', currChain?.chainId, eulerSwaps, tokenIn, tokenOut, amount !== undefined && amount.toString(), exactIn],
        staleTime: 60 * 1000,
        enabled,
        ...getErrorHandlingOptions('useEulerSwapQuoteMulti'),
        queryFn: async () => {
            let raw = await client.readContract({
                address: currChain.addresses.maglevAddrs.maglevLens,
                abi: maglevLensAbi.abi,
                functionName: 'eulerSwapQuoteMulti',
                args: [eulerSwaps, tokenIn, tokenOut, amount, exactIn],
            });

            return raw;
        },
    });
}

export function useAllowance(token, owner, spender) {
    let { data: currChain, isPending: pending1 } = useEulerChain();
    let client = usePublicClient();

    let enabled = !!(token && owner && spender && !pending1);

    return useQuery({
        queryKey: ['maglev-allowance', currChain?.chainId, token, owner, spender],
        staleTime: 60 * 1000,
        enabled,
        ...getErrorHandlingOptions('useAllowance'),
        queryFn: async () => {
            let raw = await client.readContract({
                address: token,
                abi: parseAbi(['function allowance(address owner, address spender) view returns (uint256)']),
                functionName: 'allowance',
                args: [owner, spender],
            });

            return raw;
        },
    });
}
