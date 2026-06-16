import { Link } from "react-router-dom";
import { useQueryClient } from '@tanstack/react-query';
import { useConfig, useWalletClient, usePublicClient, useAccount } from 'wagmi';
import { getAddress, parseUnits, formatUnits } from "viem";
import fromExponential from 'from-exponential';

import * as Lens from "./Lens";
import * as Utils from './Utils';
import { ContractErrorMessage } from "./ErrorBoundary";


export class GlobalContext {
    constructor(args) {
        this.args = args;

        this.subAccount = this.args.currSubAccount;
        this.subAccountIds = this.args.subAccountIds;
        let wagmiAccount = useAccount();
        this.walletAddr = wagmiAccount?.address;
        this.myPrimaryAddr = args.addr || this.walletAddr;

        this.myAddr = this.myPrimaryAddr && Utils.getSubAccountAddress(this.myPrimaryAddr, this.subAccount);
        this.connected = !!this.myPrimaryAddr;
        this.walletConnected = !!this.walletAddr;
        this.spyMode = !!args.addr && (!this.walletAddr || getAddress(args.addr) !== getAddress(this.walletAddr));
        this.canWrite = !!this.walletAddr && !this.spyMode;

        this.wagmiConfig = useConfig();
        this.client = usePublicClient();
        let { data: walletClient } = useWalletClient();
        this.walletClient = walletClient;
        this.queryClient = useQueryClient();

        let { data: currChain, error: currChainError, isError: currChainIsError } = Lens.useEulerChain();
        let { data: labels, error: labelsError, isError: labelsIsError } = Lens.useLabels();
        let { data: prices, error: pricesError, isError: pricesIsError } = Lens.usePrices();

        let vaultAddrsLabels = labels ? Object.keys(labels.vaults) : undefined;
        let vaultAddrsExtra = Object.keys(this.args.extraVaultAddrs[currChain?.chainId] || {});
        let mySubaccountMask = this.args.subAccountIds.reduce((mask, id) => mask | (1n << BigInt(id)), 0n);

        let { data: vaultsStaticLabels, error: vaultsStaticLabelsError, isError: vaultsStaticLabelsIsError } = Lens.useVaultsStaticInfo(vaultAddrsLabels);
        let { data: vaultsStaticExtra, error: vaultsStaticExtraError, isError: vaultsStaticExtraIsError } = Lens.useVaultsStaticInfo(vaultAddrsExtra);
        if (vaultsStaticLabels && vaultsStaticExtra) this.vaultsStatic = { ...vaultsStaticLabels, ... vaultsStaticExtra, };

        let { data: vaultsGlobalLabels, error: vaultsGlobalLabelsError, isError: vaultsGlobalLabelsIsError } = Lens.useVaultsGlobal(vaultAddrsLabels);
        let { data: vaultsGlobalExtra, error: vaultsGlobalExtraError, isError: vaultsGlobalExtraIsError } = Lens.useVaultsGlobal(vaultAddrsExtra);
        if (vaultsGlobalLabels && vaultsGlobalExtra) this.vaultsGlobal = { ...vaultsGlobalLabels, ...vaultsGlobalExtra, };

        let { data: vaultsPersonalLabels, error: vaultsPersonalLabelsError, isError: vaultsPersonalLabelsIsError } = Lens.useVaultsPersonalInfoMulti(this.myPrimaryAddr, mySubaccountMask, vaultAddrsLabels);
        let { data: vaultsPersonalExtra, error: vaultsPersonalExtraError, isError: vaultsPersonalExtraIsError } = Lens.useVaultsPersonalInfoMulti(this.myPrimaryAddr, mySubaccountMask, vaultAddrsExtra);
        if (vaultsPersonalLabels && vaultsPersonalExtra) {
            this.vaultsPersonal = {};
            for (let k of Object.keys(vaultsPersonalLabels)) {
                this.vaultsPersonal[k] = { ...vaultsPersonalLabels[k], ...vaultsPersonalExtra[k], };
            }
        }

        // Store error states for later use
        this.hasDataErrors = currChainIsError || labelsIsError || pricesIsError || 
                            vaultsStaticLabelsIsError || vaultsStaticExtraIsError ||
                            vaultsGlobalLabelsIsError || vaultsGlobalExtraIsError ||
                            (this.connected && (vaultsPersonalLabelsIsError || vaultsPersonalExtraIsError));
        
        this.dataErrors = {
            currChain: currChainError,
            labels: labelsError,
            prices: pricesError,
            vaultsStaticLabels: vaultsStaticLabelsError,
            vaultsStaticExtra: vaultsStaticExtraError,
            vaultsGlobalLabels: vaultsGlobalLabelsError,
            vaultsGlobalExtra: vaultsGlobalExtraError,
            vaultsPersonalLabels: vaultsPersonalLabelsError,
            vaultsPersonalExtra: vaultsPersonalExtraError,
        };

        this.currChain = currChain;
        this.labels = labels;
        this.prices = prices;

        this.chainConfigs = {};

        this.maglevSupportsChain = !!currChain?.addresses.maglevAddrs;
        this.eulerSwapSupportsChain = !!currChain?.addresses.eulerSwapAddrs;

        //console.log(!!this.maglevSupportsChain, !!this.labels, !!this.prices, !!this.vaultsStatic, !!this.vaultsGlobal, !!this.vaultsPersonal);
        this.ready = this.maglevSupportsChain && this.labels && this.prices && this.vaultsStatic && this.vaultsGlobal && (!this.connected || this.vaultsPersonal);

        if (this.ready) {
            this._setupChainConfigs();
            this._collectAssets();
            if (this.connected) this._aggregateSubAccounts();
        }
    }

    loading() {
        if (this.hasDataErrors) {
            // Find the first error to display
            for (let [key, error] of Object.entries(this.dataErrors)) {
                if (error) {
                    return <ContractErrorMessage error={error} componentName={`GlobalContext-${key}`} />;
                }
            }
        }
        
        if (!this.maglevSupportsChain) return "Maglev not currently supported on this chain.";

        return "Loading...";
    }

    addExtraVaults(vaultAddrs) {
        let v = {};

        let extraVaultAddrs = this.args.extraVaultAddrs[this.currChain.chainId] || {};

        for (let vaultAddr of Object.keys(vaultAddrs)) {
            if (this.labels.vaults[vaultAddr] || extraVaultAddrs[vaultAddr]) continue;
            v[vaultAddr] = true;
        }

        if (Object.keys(v).length) {
            setTimeout(() => this.args.setExtraVaultAddrs(
            {
                ...this.args.extraVaultAddrs,
                [this.currChain.chainId]: { ...extraVaultAddrs, ...v, },
            }), 0);
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
        if (m) return m[1];
        // Vaults without a version suffix (e.g. collateral vaults like "ecVBILL")
        // don't match the standard "e<asset>-<n>" format; fall back to stripping
        // the leading "e" rather than crashing.
        let m2 = symbol.match(/^e(.+)$/);
        return m2 ? m2[1] : symbol;
    }

    rawVaultName(addr, hideLabel) {
        let vs = this.vaultsStatic[addr];
        if (!vs) return `Unknown vault: ${addr.substr(0,8)}...`;
        let label = hideLabel ? '' : ' ' + this.labels.vaults[addr];

        return `${vs.symbol}${label}`;
    }

    renderVaultName(addr, noLinks) {
        let vs = this.vaultsStatic[addr];
        if (!vs) return `Unknown vault: ${addr.substr(0,8)}...`;
        let label = this.labels.vaults[addr];

        if (label) {
            if (!noLinks) label = <Link to={`/product/${label}`}>{label}</Link>;
        } else {
            label = <span style={{ color: 'red', }}>UNKNOWN</span>;
        }

        let m = vs.symbol.match(/^e(.*-\d+)$/);
        // Vaults without a version suffix (e.g. collateral vaults like "ecVBILL")
        // don't match the standard format; show the raw symbol instead of crashing.
        let sym = m ? m[1] : vs.symbol;

        // Only link to the detail page for vaults the lens can fully read; the
        // detail view needs global/detailed state that reverts for unsupported
        // (e.g. collateral-only) vaults, so linking there would just error.
        if (!noLinks && this.vaultsGlobal[addr]) {
            sym = <Link to={`/vault/${addr}`}>{sym}</Link>;
        }

        return <div className="vault-name">
            <div>
                <span className="symbol">{sym}</span>
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
        return formatUnits(v, 18);
    }

    render18ScalePercent(v) {
        return `${formatUnits(v * 100n, 18)}%`;
    }

    render18ScalePercentDecimals(v, decimals) {
        return `${parseFloat(formatUnits(v * 100n, 18)).toFixed(decimals)}%`;
    }

    renderNiceNum(n, plain) {
        let orig = n;
        n = parseFloat(Math.abs(n));

        let unit = '';
        if (n > 1e9) {
            n /= 1e9;
            unit = 'B';
        } else if (n > 1e6) {
            n /= 1e6;
            unit = 'M';
        } else if (n > 1e3) {
            n /= 1e3;
            unit = 'K';
        }

        n = Number(n.toPrecision(5));

        let str = (orig < 0 ? '-' : '') + fromExponential(n) + unit;

        if (plain) return str;

        return <span data-tooltip-id="maglev-tooltip" data-tooltip-content={orig} data-tooltip-place="bottom">{str}</span>;
    }

    renderUnderlying(vaultAddr, amount) {
        let decimals = this.vaultDecimals(vaultAddr);

        let value = this.amountToValue(vaultAddr, amount);

        return <div>
            <div>
                {this.renderNiceNum(formatUnits(amount, decimals))}
            </div>
            <div>
                {this.renderValue(value)}
            </div>
        </div>
    }

    renderValue(value) {
        return typeof(value) === 'bigint' ? <span>${this.renderNiceNum(formatUnits(value, 18))}</span> : <span style={{ color: 'red', }}>?</span>;
    }

    renderUnderlyingPlain(vaultAddr, amount) {
        let decimals = this.vaultDecimals(vaultAddr);
        return this.renderNiceNum(formatUnits(amount, decimals), true);
    }

    renderValuePlain(value) {
        return typeof(value) === 'bigint' ? '$' + formatUnits(value, 18) : '?';
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

        let personal = vaultsPersonal[vaultAddr];

        // Unsupported vaults (the lens reverts on their global/personal state, e.g.
        // collateral-only vaults) have no readable data; treat them as empty.
        if (!personal || !this.vaultsGlobal[vaultAddr]) {
            return { shares: 0n, assets: 0n, value: 0n, valueNum: 0, debt: 0n, debtValue: 0n, debtValueNum: 0 };
        }

        let shares = personal.balance;
        let assets = this.sharesToAssets(vaultAddr, shares);
        let value = this.amountToValue(vaultAddr, assets);
        let debt = personal.debt;
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
        if (!vg) return { borrowAPY: NaN, supplyAPY: NaN };
        return {
            borrowAPY: Number(vg.borrowAPY) / 1e9,
            supplyAPY: Number(vg.supplyAPY) / 1e9,
        };
    }


    etherscanAddress(addr, text) {
        if (!this.currChain) return addr;
        let config = this.chainConfigs[this.currChain.chainId];
        let url = config?.blockExplorers?.default?.url;
        if (!url) {
            if (this.currChain.chainId === 31337) url = 'https://unknown-block-explorer.example';
            else return text;
        }

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
        let o = {};

        for (let i of this.args.subAccountIds) {
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

            o[i] = agg;
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
