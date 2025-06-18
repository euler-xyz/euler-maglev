import { useQueryClient } from '@tanstack/react-query';
import { useConfig, useWalletClient, usePublicClient, useAccount } from 'wagmi';
import { parseUnits, formatUnits } from "viem";
import fromExponential from 'from-exponential';

import * as Lens from "./Lens";
import * as Utils from './Utils';


export class GlobalContext {
    constructor(args) {
        this.args = args;

        this.subAccount = this.args.currSubAccount;
        this.numSubAccounts = this.args.numSubAccounts;
        let wagmiAccount = useAccount();
        this.myPrimaryAddr = args.addr || wagmiAccount?.address;

        this.myAddr = this.myPrimaryAddr && Utils.getSubAccountAddress(this.myPrimaryAddr, this.subAccount);
        this.connected = !!this.myPrimaryAddr;

        this.wagmiConfig = useConfig();
        this.client = usePublicClient();
        let { data: walletClient } = useWalletClient();
        this.walletClient = walletClient;
        this.queryClient = useQueryClient();

        let { data: currChain } = Lens.useEulerChain();
        let { data: labels } = Lens.useLabels();
        let { data: prices } = Lens.usePrices();

        let vaultAddrsLabels = labels ? Object.keys(labels.vaults) : undefined;
        let vaultAddrsExtra = Object.keys(this.args.extraVaultAddrs);
        let mySubaccountMask = (1n << BigInt(this.args.numSubAccounts)) - 1n;

        let { data: vaultsStaticLabels } = Lens.useVaultsStaticInfo(vaultAddrsLabels);
        let { data: vaultsStaticExtra } = Lens.useVaultsStaticInfo(vaultAddrsExtra);
        if (vaultsStaticLabels && vaultsStaticExtra) this.vaultsStatic = { ...vaultsStaticLabels, ... vaultsStaticExtra, };

        let { data: vaultsGlobalLabels } = Lens.useVaultsGlobal(vaultAddrsLabels);
        let { data: vaultsGlobalExtra } = Lens.useVaultsGlobal(vaultAddrsExtra);
        if (vaultsGlobalLabels && vaultsGlobalExtra) this.vaultsGlobal = { ...vaultsGlobalLabels, ...vaultsGlobalExtra, };

        let { data: vaultsPersonalLabels } = Lens.useVaultsPersonalInfoMulti(this.myPrimaryAddr, mySubaccountMask, vaultAddrsLabels);
        let { data: vaultsPersonalExtra } = Lens.useVaultsPersonalInfoMulti(this.myPrimaryAddr, mySubaccountMask, vaultAddrsExtra);
        if (vaultsPersonalLabels && vaultsPersonalExtra) {
            this.vaultsPersonal = {};
            for (let k of Object.keys(vaultsPersonalLabels)) {
                this.vaultsPersonal[k] = { ...vaultsPersonalLabels[k], ...vaultsPersonalExtra[k], };
            }
        }

        this.currChain = currChain;
        this.labels = labels;
        this.prices = prices;

        this.chainConfigs = {};

        //console.log(!!this.labels, !!this.prices, !!this.vaultsStatic, !!this.vaultsGlobal, !!this.vaultsPersonal);
        this.ready = this.labels && this.prices && this.vaultsStatic && this.vaultsGlobal && (!this.connected || this.vaultsPersonal);

        if (this.ready) {
            this._setupChainConfigs();
            this._collectAssets();
            if (this.connected) this._aggregateSubAccounts();
        }
    }

    addExtraVaults(vaultAddrs) {
        let v = {};

        for (let vaultAddr of Object.keys(vaultAddrs)) {
            if (this.labels.vaults[vaultAddr] || this.args.extraVaultAddrs.vaults[vaultAddr]) continue;
            v[vaultAddr] = true;
        }

        if (Object.keys(v).length) {
            setTimeout(() => this.args.setExtraVaultAddrs({ ...this.args.extraVaultAddrs.vaults, ...v, }), 0);
            return false;
        }

        return true;
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

    rawVaultName(addr, hideLabel) {
        let vs = this.vaultsStatic[addr];
        if (!vs) return `Unknown vault: ${addr.substr(0,8)}...`;
        let label = hideLabel ? '' : ' ' + this.labels.vaults[addr];

        return `${vs.symbol}${label}`;
    }

    renderVaultName(addr) {
        let vs = this.vaultsStatic[addr];
        if (!vs) return `Unknown vault: ${addr.substr(0,8)}...`;
        let label = this.labels.vaults[addr] || <span style={{ color: 'red', }}>UNKNOWN</span>;

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
        let asset = this.vaultsStatic[vaultAddr]?.asset;
        if (!asset) return NaN;
        let price = this.prices[asset];
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

    vaultStatus(vaultAddr, vaultsPersonal) {
        if (!vaultsPersonal) vaultsPersonal = this.vaultsPersonal[this.subAccount];

        let shares = vaultsPersonal[vaultAddr].balance;
        let assets = this.sharesToAssets(vaultAddr, shares);
        let value = this.amountToValue(vaultAddr, assets);
        let debt = vaultsPersonal[vaultAddr].debt;
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


    etherscanAddress(addr, text) {
        if (!this.currChain) return addr;
        let config = this.chainConfigs[this.currChain.chainId];
        let url = config?.blockExplorers?.default?.url;
        if (!url) return addr;

        return <a href={`${url}/address/${addr}`}>{text || addr}</a>
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

        for (let i = 0; i < this.args.numSubAccounts; i++) {
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

    _setupChainConfigs() {
        if (!this.wagmiConfig) return;

        for (let c of this.wagmiConfig.chains) {
            this.chainConfigs[c.id] = c;
        }
    }
}

export function useGlobalContext(opts) {
    return new GlobalContext(opts);
}
