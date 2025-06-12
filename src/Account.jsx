import { useState } from 'react';

import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { TabMenu } from 'primereact/tabmenu';
import { Chip } from 'primereact/chip';
import { Card } from 'primereact/card';

import { useGlobalContext } from "./Ctx";
import { EulerSwapPanel } from "./EulerSwap";



export function AccountPanel() {
    let [activeTab, setActiveTab] = useState(0);
    let [numAccounts, setNumAccounts] = useState(3);
    let ctx = useGlobalContext({ numAccounts, subAccount: activeTab, });

    if (!ctx.ready) return "Loading...";
    if (!ctx.connected) return "Please connect your wallet.";

    let tabs = [];

    for (let i = 0; i < numAccounts; i++) {
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

    tabs.push({
        label: `+ New`,
        command: () => {
            setNumAccounts(numAccounts + 1);
        },
    });

    return <div>
        <TabMenu model={tabs} activeIndex={activeTab} onTabChange={(e) => setActiveTab(e.index)} />
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

    if (!rows.length) return <Card>No assets or liabilities found in account {props.currAccount}.</Card>;

    return <Card title={`Account ${acct.subAccount}`} key={acct.subAccount}>
        <DataTable value={rows} showGridlines tableStyle={{ minWidth: '50rem' }}>
            <Column field="vault" header="Vault"></Column>
            <Column field="balance" header="Balance"></Column>
            <Column field="debt" header="Debt"></Column>
            <Column field="apy" header="APY"></Column>
        </DataTable>

        <EulerSwapPanel ctx={ctx} />
    </Card>
}
