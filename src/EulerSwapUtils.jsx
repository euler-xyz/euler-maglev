import { parseAbi, zeroAddress, encodeFunctionData } from 'viem';

import * as Utils from './Utils';
import * as LibEulerSwap from './LibEulerSwap';

import evcAbi from '../abis/EthereumVaultConnector.json';
import iEulerSwapAbi from '../abis/IEulerSwap.json';
import iEulerSwapPeripheryAbi from '../abis/IEulerSwapPeriphery.json';
import eulerSwapFactoryAbi from '../abis/EulerSwapFactory.json';
import maglevLensAbi from '../abis/MaglevLens.json';



export async function deployEulerSwap(ctx, params, initialState, oldReserves) {
    console.log('DEPLOYING EULERSWAP', params, initialState);
    let [predictedAddress, salt] = await LibEulerSwap.genAddress(ctx.client, ctx.currChain.addresses.eulerSwapAddrs.eulerSwapFactory, params);

    let previousOperator = await ctx.client.readContract({
        address: ctx.currChain.addresses.eulerSwapAddrs.eulerSwapFactory,
        abi: eulerSwapFactoryAbi.abi,
        functionName: 'poolByEulerAccount',
        args: [ctx.myAddr],
    });

    let batch = [];

    if (oldReserves) {
        batch.push({
            targetContract: ctx.currChain.addresses.maglevAddrs.maglevLens,
            onBehalfOfAccount: ctx.myAddr,
            value: 0n,
            data: encodeFunctionData({
                abi: maglevLensAbi.abi,
                functionName: 'assertEulerSwapReserves',
                args: [previousOperator, oldReserves.reserve0, oldReserves.reserve0, oldReserves.reserve1, oldReserves.reserve1],
            }),
        })
    }

    if (previousOperator !== zeroAddress) {
        batch.push({
            targetContract: ctx.currChain.addresses.coreAddrs.evc,
            onBehalfOfAccount: zeroAddress,
            value: 0n,
            data: encodeFunctionData({
                abi: evcAbi.abi,
                functionName: 'setAccountOperator',
                args: [ctx.myAddr, previousOperator, false],
            }),
        });
    }

    batch.push({
        targetContract: ctx.currChain.addresses.coreAddrs.evc,
        onBehalfOfAccount: zeroAddress,
        value: 0n,
        data: encodeFunctionData({
            abi: evcAbi.abi,
            functionName: 'setAccountOperator',
            args: [ctx.myAddr, predictedAddress, true],
        }),
    });

    batch.push({
        targetContract: ctx.currChain.addresses.eulerSwapAddrs.eulerSwapFactory,
        onBehalfOfAccount: ctx.myAddr,
        value: 0n,
        data: encodeFunctionData({
            abi: eulerSwapFactoryAbi.abi,
            functionName: 'deployPool',
            args: [params, initialState, salt],
        }),
    });

    await Utils.executeTxn(ctx, {
        account: ctx.myPrimaryAddr,
        address: ctx.currChain.addresses.coreAddrs.evc,
        abi: evcAbi.abi,
        functionName: 'batch',
        args: [batch],
    });

    ctx.queryClient.resetQueries({ queryKey: ['maglev-eulerSwap'], });
}

export async function uninstallEulerSwap(ctx) {
    let previousOperator = await ctx.client.readContract({
        address: ctx.currChain.addresses.eulerSwapAddrs.eulerSwapFactory,
        abi: eulerSwapFactoryAbi.abi,
        functionName: 'poolByEulerAccount',
        args: [ctx.myAddr],
    });

    let batch = [];

    if (previousOperator !== zeroAddress) {
        batch.push({
            targetContract: ctx.currChain.addresses.coreAddrs.evc,
            onBehalfOfAccount: zeroAddress,
            value: 0n,
            data: encodeFunctionData({
                abi: evcAbi.abi,
                functionName: 'setAccountOperator',
                args: [ctx.myAddr, previousOperator, false],
            }),
        });
    }

    batch.push({
        targetContract: ctx.currChain.addresses.eulerSwapAddrs.eulerSwapFactory,
        onBehalfOfAccount: ctx.myAddr,
        value: 0n,
        data: encodeFunctionData({
            abi: eulerSwapFactoryAbi.abi,
            functionName: 'uninstallPool',
            args: [],
        }),
    });

    await Utils.executeTxn(ctx, {
        account: ctx.myPrimaryAddr,
        address: ctx.currChain.addresses.coreAddrs.evc,
        abi: evcAbi.abi,
        functionName: 'batch',
        args: [batch],
    });

    ctx.queryClient.resetQueries({ queryKey: ['maglev-eulerSwap'], });
}


export async function doSwapExactIn(ctx, eulerSwap, tokenIn, tokenOut, amountIn, amountOutMin) {
    console.log("DOING EXACTIN SWAP", eulerSwap, tokenIn, tokenOut, amountIn, amountOutMin);

    await Utils.executeTxn(ctx, {
        account: ctx.myPrimaryAddr,
        address: ctx.currChain.addresses.eulerSwapAddrs.eulerSwapPeriphery,
        abi: iEulerSwapPeripheryAbi.abi,
        functionName: 'swapExactIn',
        args: [eulerSwap, tokenIn, tokenOut, amountIn, ctx.myPrimaryAddr, amountOutMin, 0n],
    });
}

export async function doSwapExactOut(ctx, eulerSwap, tokenIn, tokenOut, amountOut, amountInMax) {
    console.log("DOING EXACTOUT SWAP", eulerSwap, tokenIn, tokenOut, amountOut, amountInMax);

    await Utils.executeTxn(ctx, {
        account: ctx.myPrimaryAddr,
        address: ctx.currChain.addresses.eulerSwapAddrs.eulerSwapPeriphery,
        abi: iEulerSwapPeripheryAbi.abi,
        functionName: 'swapExactOut',
        args: [eulerSwap, tokenIn, tokenOut, amountOut, ctx.myPrimaryAddr, amountInMax, 0n],
    });
}

export async function doApprove(ctx, token, spender, value) {
    console.log("DOING APPROVE", token, spender, value);

    await Utils.executeTxn(ctx, {
        account: ctx.myPrimaryAddr,
        address: token,
        abi: parseAbi(['function approve(address spender, uint256 value) external']),
        functionName: 'approve',
        args: [spender, value],
    });

    ctx.queryClient.resetQueries({ queryKey: ['maglev-allowance'], });
}
