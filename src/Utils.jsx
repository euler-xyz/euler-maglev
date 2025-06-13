import { getAddress, parseUnits, formatUnits, parseAbi } from "viem";


export function getSubAccountAddress(addr, id) {
    return getAddress('0x' + (BigInt(addr) ^ BigInt(id)).toString(16).padStart(40, '0'));
}

export function hex2a(inp) {
    let hex = inp.toString();
    let str = '';
    for (let i = 0; i < hex.length; i += 2) {
        str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    }
    return str;
}

const decoder = new TextDecoder('utf-8');

export function utf8Decode(inp) {
    return decoder.decode(Uint8Array.from(inp.split('').map(x => x.charCodeAt())));
}

export async function executeTxn(ctx, args) {
    //let gas = await ctx.client.estimateGas(args);
    let gas = 1000000n; // FIXME: estimateGas is very wrong, at least in dev?

    args = { gas, ...args };

    let { request } = await ctx.client.simulateContract(args);

    let hash = await ctx.walletClient.writeContract(request);

    let receipt = await ctx.client.waitForTransactionReceipt({ hash, });

    return receipt;
}
