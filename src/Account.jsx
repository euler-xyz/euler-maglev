import { useState } from 'react';

import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { TabMenu } from 'primereact/tabmenu';
import { Chip } from 'primereact/chip';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Message } from 'primereact/message';

import { EulerSwapPanel } from "./EulerSwap";
import * as Utils from './Utils';



export function AccountPanel(props) {
    let ctx = props.ctx;
    let [importValue, setImportValue] = useState('');
    let [importError, setImportError] = useState();

    if (!ctx.ready) return ctx.loading();
    if (!ctx.connected) return "Please connect your wallet.";

    let addSubAccount = (id) => {
        if (!Number.isInteger(id) || id < 0 || id > 255) {
            throw new Error("Subaccount ID must be between 0 and 255");
        }

        let nextIds = ctx.subAccountIds.includes(id)
            ? ctx.subAccountIds
            : [...ctx.subAccountIds, id].sort((a, b) => a - b);

        ctx.args.setSubAccountIds(nextIds);
        ctx.args.setCurrSubAccount(id);
    };

    let newSubAccount = () => {
        for (let i = 0; i < 256; i++) {
            if (!ctx.subAccountIds.includes(i)) {
                addSubAccount(i);
                return;
            }
        }

        setImportError("All subaccounts are already loaded.");
    };

    let importSubAccount = () => {
        try {
            let raw = importValue.trim();
            let id;

            if (/^\d+$/.test(raw)) {
                id = Number(raw);
            } else {
                id = Utils.getSubAccountId(ctx.myPrimaryAddr, raw);
            }

            addSubAccount(id);
            setImportValue('');
            setImportError(undefined);
        } catch (e) {
            setImportError(e.shortMessage || e.message || "Could not import subaccount.");
        }
    };

    let tabs = [];

    for (let i of ctx.subAccountIds) {
        let sa = ctx.subAccounts[i];
        let leverage = sa.assets ? Number(sa.assets*100n/sa.nav)/100 : 1;
        tabs.push({
            label: <div>
                <div>Acct {i}</div>
                <div className="mb-1 mt-1">{ctx.renderValue(sa.nav)}</div>
                <div>{leverage !== 1 ? `${leverage}x` : ''}</div>
            </div>,
        });
    }

    return <div>
        <TabMenu model={tabs} activeIndex={ctx.subAccountIds.indexOf(ctx.subAccount)} onTabChange={(e) => ctx.args.setCurrSubAccount(ctx.subAccountIds[e.index])} />

        <div className="flex align-items-center gap-2 mt-3 mb-3">
            <Button label="+ New" onClick={newSubAccount} />
            <InputText value={importValue} placeholder="Subaccount ID or address" onChange={e => setImportValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') importSubAccount(); }} />
            <Button label="Import" disabled={!importValue.trim()} onClick={importSubAccount} />
        </div>

        {importError && <Message severity="error" text={importError} className="mb-3" />}

        <SubAccountView ctx={ctx} />
    </div>
}

function SubAccountView(props) {
    let ctx = props.ctx;
    let acct = ctx.currSubAccount();

    let rows = [];

    for (let vaultAddr of Object.keys(acct.vaults)) {
        let v = acct.vaults[vaultAddr];
        let irs = ctx.getIRs(vaultAddr);

        rows.push({
            vault: <div className="flex align-items-center">
                {ctx.renderVaultName(vaultAddr)}
                {v.controller && <Chip className="ml-3" style={{backgroundColor:'#650000'}} label="controller" />}
                {v.collateral && <Chip className="ml-3" style={{backgroundColor:'#386448'}} label="collateral" />}
            </div>,
            balance: ctx.renderShares(vaultAddr, v.balance),
            debt: ctx.renderUnderlying(vaultAddr, v.debt),
            apy: <div>
                {v.balance > 0n && <div style={{ color: 'green', }}>+{(irs.supplyAPY * 100).toFixed(3)}%</div>}
                {v.debt > 0n && <div style={{ color: 'red', }}>-{(irs.borrowAPY * 100).toFixed(3)}%</div>}
            </div>,
        });
    }

    if (!rows.length) return <Card title={`Account ${acct.subAccount}`} key={acct.subAccount}>
        <div className="mb-3">{ctx.etherscanAddress(ctx.myAddr)}</div>
        <div>No assets or liabilities found in account {acct.subAccount}.</div>
    </Card>;

    return <Card title={`Account ${acct.subAccount}`} key={acct.subAccount}>
        <div className="mb-3">{ctx.etherscanAddress(ctx.myAddr)}</div>

        <DataTable value={rows} showGridlines tableStyle={{ minWidth: '50rem' }}>
            <Column field="vault" header="Vault"></Column>
            <Column field="balance" header="Balance"></Column>
            <Column field="debt" header="Debt"></Column>
            <Column field="apy" header="APY"></Column>
        </DataTable>

        <EulerSwapPanel ctx={ctx} />
    </Card>
}
