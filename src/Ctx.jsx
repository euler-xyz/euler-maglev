import { useQueryClient } from '@tanstack/react-query';
import { useWalletClient, usePublicClient, useAccount } from 'wagmi';
import { parseUnits, formatUnits } from "viem";
import fromExponential from 'from-exponential';

import * as Lens from "./Lens";
import * as Utils from './Utils';


export class GlobalContext {
    constructor(numAccounts, subAccount) {
        this.numAccounts = numAccounts;
        this.subAccount = subAccount;
        this.account = useAccount();
        this.myPrimaryAddr = this.account.address;
        this.myAddr = this.account.address && Utils.getSubAccountAddress(this.account.address, subAccount);
        this.connected = !!this.myPrimaryAddr;

        this.client = usePublicClient();
        let { data: walletClient } = useWalletClient();
        this.walletClient = walletClient;
        this.queryClient = useQueryClient();

        let { data: currChain } = Lens.useEulerChain();
        let { data: labels } = Lens.useLabels();
        let { data: vaultsStatic } = Lens.useVaultsStaticInfo();
        let { data: vaultsGlobal } = Lens.useVaultsGlobal();
        let { data: prices } = Lens.usePrices();

        let { data: vaultsPersonal } = Lens.useVaultsPersonalInfo(this.account.address, (1n << BigInt(numAccounts)) - 1n);

        this.currChain = currChain;
        this.labels = labels;
        this.vaultsStatic = vaultsStatic;
        this.vaultsGlobal = vaultsGlobal;
        this.prices = prices;
        this.vaultsPersonal = vaultsPersonal;

        this.ready = this.labels && this.vaultsStatic && this.vaultsGlobal && this.prices && (!this.connected || this.vaultsPersonal);

        if (this.ready) {
            this._collectAssets();
            if (this.connected) this._aggregateSubAccounts();
        }
    }

    renderVaultAsset(addr) {
        let vs = this.vaultsStatic[addr];
        if (!vs) return `???`;

        return this.vaultSymbolToAssetSymbol(vs.symbol);
    }

    vaultSymbolToAssetSymbol(symbol) {
        let m = symbol.match(/^e(.*)-(\d+)$/);
        return m[1];
    }

    rawVaultName(addr) {
        let vs = this.vaultsStatic[addr];
        if (!vs) return `Unknown vault: ${addr.substr(0,8)}...`;
        let label = this.labels[addr];

        return `${vs.symbol} ${label}`;
    }

    renderVaultName(addr) {
        let vs = this.vaultsStatic[addr];
        if (!vs) return `Unknown vault: ${addr.substr(0,8)}...`;
        let label = this.labels[addr];

        let m = vs.symbol.match(/^e(.*)-(\d+)$/);
        let sym = m[1];
        let id = m[2];

        return <div className="vault-name">
            <div>
                <span className="symbol">{sym}</span> <span>{id}</span>
            </div>
            <div className="product">
                {label}
            </div>
        </div>;
    }

    vaultDecimals(vaultAddr) {
        let decimals = this.vaultsStatic[vaultAddr]?.decimals;
        if (decimals === undefined) return NaN;
        return decimals;
    }

    vaultAssetPrice(vaultAddr) {
        let price = this.prices[this.vaultsStatic[vaultAddr].asset];
        if (!price) return NaN;
        return price.price;
    }

    amountToValue(vaultAddr, amount) {
        let decimals = this.vaultDecimals(vaultAddr);

        let price = this.vaultAssetPrice(vaultAddr);
        if (isNaN(price)) return NaN;

        return amount * parseUnits(fromExponential(price), 18) / 10n**(BigInt(decimals));
    }

    valueToAmount(vaultAddr, value) {
        let decimals = this.vaultDecimals(vaultAddr);

        let price = this.vaultAssetPrice(vaultAddr);
        if (isNaN(price)) return NaN;

        return parseUnits(fromExponential(value), decimals) * 10n**(BigInt(18)) / parseUnits(price.toString(), 18);
    }

    numTo18Scale(v) {
        return parseUnits(fromExponential(v), 18);
    }

    render18Scale(v) {
        return parseFloat(formatUnits(v, 18));
    }

    render18ScalePercent(v) {
        return `${parseFloat(formatUnits(v, 18)) * 100}%`;
    }

    renderUnderlying(vaultAddr, amount) {
        let decimals = this.vaultDecimals(vaultAddr);

        let value = this.amountToValue(vaultAddr, amount);

        return <div>
            <div>
                {formatUnits(amount, decimals)}
            </div>
            <div>
                {this.renderValue(value)}
            </div>
        </div>
    }

    renderValue(value) {
        return typeof(value) === 'bigint' ? '$' + formatUnits(value, 18) : <span style={{ color: 'red', }}>?</span>;
    }

    valueToNum(value) {
        return parseFloat(formatUnits(value, 18));
    }

    sharesToAssets(vaultAddr, numShares) {
        const VIRTUAL_DEPOSIT_AMOUNT = 1000000n;
        let v = this.vaultsGlobal[vaultAddr];
        if (!v) return NaN;
        return numShares * (v.assets + VIRTUAL_DEPOSIT_AMOUNT) / (v.shares + VIRTUAL_DEPOSIT_AMOUNT);
    }

    renderShares(vaultAddr, numShares) {
        let amount = this.sharesToAssets(vaultAddr, numShares);
        return this.renderUnderlying(vaultAddr, amount);
    }


    currSubAccount() {
        return this.subAccounts[this.subAccount];
    }

    vaultStatus(vaultAddr) {
        let shares = this.vaultsPersonal[this.subAccount][vaultAddr].balance;
        let assets = this.sharesToAssets(vaultAddr, shares);
        let value = this.amountToValue(vaultAddr, assets);
        let debt = this.vaultsPersonal[this.subAccount][vaultAddr].debt;
        let debtValue = this.amountToValue(vaultAddr, debt);

        return {
            shares,
            assets,
            value,
            valueNum: this.valueToNum(value),

            debt,
            debtValue,
            debtValueNum: this.valueToNum(debtValue),
        };
    }

    getIRs(vaultAddr) {
        let vg = this.vaultsGlobal[vaultAddr];
        return {
            borrowAPY: Number(vg.borrowAPY) / 1e9,
            supplyAPY: Number(vg.supplyAPY) / 1e9,
        };
    }


    _collectAssets() {
        this.knownAssets = {};

        for (let v of Object.values(this.vaultsStatic)) {
            this.knownAssets[this.vaultSymbolToAssetSymbol(v.symbol)] = {
                addr: v.asset,
                decimals: v.decimals,
            };
        }
    }

    _aggregateSubAccounts() {
        let o = [];

        for (let i = 0; i < this.numAccounts; i++) {
            let vaults = this.vaultsPersonal[i];
            let agg = {
                subAccount: i,
                vaults: {},
                nav: 0n,
                assets: 0n,
            };

            for (let vaultAddr of Object.keys(vaults)) {
                let v = vaults[vaultAddr];
                if (v.balance === 0n && v.debt === 0n && !v.collateral && !v.controller) continue;
                agg.vaults[vaultAddr] = v;
                let assets = this.amountToValue(vaultAddr, this.sharesToAssets(vaultAddr, v.balance));
                agg.assets += assets;
                agg.nav += assets;
                agg.nav -= this.amountToValue(vaultAddr, v.debt);
            }

            o.push(agg);
        }

        this.subAccounts = o;
    }
}

export function useGlobalContext(numAccounts, subAccount) {
    return new GlobalContext(numAccounts, subAccount);
}
