import { parseUnits, getAddress, encodeAbiParameters, parseAbi, zeroAddress, encodeFunctionData, encodePacked, keccak256, fromHex, toHex } from 'viem';
import { generatePrivateKey } from 'viem/accounts';

import * as Lens from './Lens';
import * as Utils from './Utils';

import evcAbi from '../abis/EthereumVaultConnector.json';
import iEulerSwapAbi from '../abis/IEulerSwap.json';
import iEulerSwapPeripheryAbi from '../abis/IEulerSwapPeriphery.json';
import eulerSwapFactoryAbi from '../abis/EulerSwapFactory.json';
import maglevLensAbi from '../abis/MaglevLens.json';

const paramsAbi = iEulerSwapAbi.abi.find(item => item.name === 'getParams').outputs;


export async function genAddress(ctx, params) {
    let mask = BigInt(2**14 - 1);
    let requiredHooks = 10408n;

    let salt = fromHex(generatePrivateKey(), 'bigint');
    let creationCodeHash = keccak256(await creationCode(ctx, params));

    while (true) {
        salt++;
        let saltHex = toHex(salt, { size: 32 });

        let a = encodePacked(['bytes1', 'address', 'bytes32', 'bytes32'], ['0xFF', ctx.currChain.addresses.eulerSwapAddrs.eulerSwapFactory, saltHex, creationCodeHash]);
        a = keccak256(a);

        if ((fromHex(a, 'bigint') & mask) === requiredHooks) {
            return [getAddress('0x' + a.substr(26)), saltHex];
        }
    }
}

export async function creationCode(ctx, params) {
    let BYTECODE_HEAD = '600b380380600b3d393df3363d3d373d3d3d3d60368038038091363936013d73';
    let BYTECODE_TAIL = '5af43d3d93803e603457fd5bf3';

    let eulerSwapImpl = await ctx.client.readContract({
        address: ctx.currChain.addresses.eulerSwapAddrs.eulerSwapFactory,
        abi: eulerSwapFactoryAbi.abi,
        functionName: 'eulerSwapImpl',
        args: [],
    });

    let encoded = encodeAbiParameters(paramsAbi, [params]);

    return '0x' + BYTECODE_HEAD + eulerSwapImpl.substr(2) + BYTECODE_TAIL + encoded.substr(2);
}

export async function deployEulerSwap(ctx, params, initialState, oldReserves) {
    console.log('DEPLOYING EULERSWAP', params, initialState);
    let [predictedAddress, salt] = await genAddress(ctx, params);

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
        abi: parseAbi(['function approve(address spender, uint256 value) external returns (bool)']),
        functionName: 'approve',
        args: [spender, value],
    });

    ctx.queryClient.resetQueries({ queryKey: ['maglev-allowance'], });
}






export const c1e18 = 10n**18n;

export function f(x, px, py, x0, y0, c) {
    let v = (px * (x0 - x)) * (c * x + (c1e18 - c) * x0);
    let denom = x * c1e18;
    v = (v + (denom - 1n)) / denom;
    return y0 + (v + (py - 1n)) / py;
}

export function verify(x, y, px, py, x0, y0, cx, cy) {
    if (x >= x0) {
        if (y >= y0) return true;
        return x >= f(y, py, px, y0, x0, cy);
    } else {
        if (y < y0) return false;
        return y >= f(x, px, py, x0, y0, cx);
    }
}

export function verifyOnCurveExact(x, y, px, py, x0, y0, cx, cy) {
    let v1 = verify(x, y, px, py, x0, y0, cx, cy);
    let v2 = x === 0n || !verify(x - 1n, y, px, py, x0, y0, cx, cy);
    let v3 = y === 0n || !verify(x, y - 1n, px, py, x0, y0, cx, cy);

    return (v1 && v2 && v3);
}

export function tightenToCurve(x, y, px, py, x0, y0, cx, cy) {
    if (!verify(x, y, px, py, x0, y0, cx, cy)) throw Error('not on or above curve');

    let tighten = (dim) => {
        let val = 1n;

        // Phase 1: Keep doubling skim amount until it fails

        while (true) {
            let [tx, ty] = dim ? [x - val, y] : [x, y - val];

            if (verify(tx, ty, px, py, x0, y0, cx, cy)) {
                [x, y] = [tx, ty];
                val *= 2n;
            } else {
                break;
            }
        }

        // Phase 2: Keep halving skim amount until 1 wei skim fails

        while (true) {
            if (val > 1n) val /= 2n;

            let [tx, ty] = dim ? [x - val, y] : [x, y - val];

            if (verify(tx, ty, px, py, x0, y0, cx, cy)) {
                [x, y] = [tx, ty];
            } else {
                if (val === 1n) break;
            }
        }
    };

    tighten(true);
    tighten(false);

    return [x, y];
}

export function df_dx(x, px, py, x0, cx) {
    const r = (((x0 * x0) / x) * c1e18) / x;
    return (-px * (cx + ((c1e18 - cx) * r) / c1e18)) / py;
}

export function computeScale(x) {
    let bits = 0n;
    let remaining = x;
    while (remaining > 0n) {
        remaining >>= 1n;
        bits++;
    }

    if (bits > 128n) {
        const excessBits = bits - 128n;
        return 1n << excessBits;
    }

    return 1n;
}

export function bigintSqrt(x) {
    if (x < 0n) {
        throw new Error("Square root of negative number");
    }
    if (x < 2n) {
        return x;
    }

    function newtonIteration(n, x0) {
        const x1 = (n / x0 + x0) >> 1n;
        if (x0 === x1 || x0 === x1 - 1n) {
            return x0;
        }
        return newtonIteration(n, x1);
    }

    return newtonIteration(x, 1n << (BigInt(x.toString(2).length) >> 1n));
}

export function bigintCeil(x) {
    if (x >= 0n) {
        return x;
    }
    const absX = x >= 0n ? x : -x;
    const quotient = absX / c1e18;
    const remainder = absX % c1e18;
    return remainder === 0n ? quotient : quotient + 1n;
}

export function fInverse(y, px, py, x0, y0, cx) {
    const term1 = (((py * c1e18 * (y - y0)) / px) * c1e18) / px;
    const term2 = (2n * cx - c1e18) * x0;
    const B = (term1 - term2) / c1e18;
    const C = ((c1e18 - cx) * x0 * x0) / c1e18;
    const fourAC = (4n * cx * C) / c1e18;

    const absB = B >= 0n ? B : -B;

    let sqrt = 0n;
    let squaredB = 0n;
    let discriminant = 0n;
    if (absB < 10n ** 36n) {
        squaredB = absB * absB;
        discriminant = squaredB + fourAC;
        sqrt = bigintSqrt(discriminant);
    } else {
        const scale = computeScale(absB);
        squaredB = ((absB / scale) * absB) / scale;
        discriminant = squaredB + fourAC / (scale * scale);
        sqrt = bigintSqrt(discriminant);
        sqrt = sqrt * scale;
    }

    let x = 0n;
    if (B <= 0n) {
        x = (absB + sqrt) / 2n + 1n;
    } else {
        x = bigintCeil((2n * C) / (absB + sqrt)) + 1n;
    }

    if (x >= x0) {
        return x0;
    }

    return x;
}




export function computePriceFraction(price, decimals0, decimals1) {
    let price18scale;
    let inverted = false;

    try {
        price = parseFloat(price);
        if (isNaN(price) || !price) throw Error('not a valid price');
        if (price < 1) {
            inverted = true;
            price = 1 / price;
        }
        price18scale = parseUnits(price.toString(), 18);
    } catch (e) {
        return [undefined, undefined];
    }

    let output = [
        10n**(BigInt(decimals1)),
        10n**(BigInt(decimals0)),
    ];

    if (!inverted) {
        output[0] = output[0] * price18scale / c1e18;
    } else {
        output[1] = output[1] * price18scale / c1e18;
    }

    return output;
}
