import { useState } from 'react';

import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { TabMenu } from 'primereact/tabmenu';
import { Chip } from 'primereact/chip';
import { Card } from 'primereact/card';
import { InputText } from 'primereact/inputtext';
import { Paginator } from 'primereact/paginator';

import * as EulerSwapUtils from "./EulerSwapUtils";



export function VaultList(props) {
    let [first, setFirst] = useState(0);
    let [numRows, setNumRows] = useState(10);
    let [search, setSearch] = useState('');

    let ctx = props.ctx;

    if (!ctx.ready) return "Loading...";

    let rows = [];

    for (let vaultAddr of Object.keys(ctx.vaultsStatic)) {
        let global = ctx.vaultsGlobal[vaultAddr];
        let irs = ctx.getIRs(vaultAddr);

        let utilisation = `${(ctx.render18Scale(global.assets ? global.borrows * EulerSwapUtils.c1e18 / global.assets : 0) * 100).toFixed(3)}%`;

        rows.push({
            vault: <div className="flex align-items-center">
                {ctx.renderVaultName(vaultAddr)}
            </div>,
            totalSupply: ctx.renderUnderlying(vaultAddr, global.assets),
            utilisation,
            supplyApy: <div>{(irs.supplyAPY * 100).toFixed(3)}%</div>,
            borrowApy: <div>{(irs.borrowAPY * 100).toFixed(3)}%</div>,

            val: ctx.amountToValue(vaultAddr, global.assets),
            rawName: ctx.rawVaultName(vaultAddr).toLowerCase(),
        });
    }

    if (!rows.length) return <Card>No matching vaults found.</Card>;

    if (search) {
        let res = search.split(/\s+/).filter(x => x.length).map(x => RegExp(x));
        rows = rows.filter(row => {
            for (let re of res) {
                if (!row.rawName.match(re)) return false;
            }
            return true;
        });
    }

    let bigintSign = n => n < 0n ? -1 : n > 0n ? 1 : 0;
    rows.sort((a,b) => {
        if (typeof(a.val) !== 'bigint') return 1;
        if (typeof(b.val) !== 'bigint') return -1;
        return bigintSign(b.val - a.val);
    });

    let onPageChange = (event) => {
        setFirst(event.first);
        setNumRows(event.rows);
    };

    let totalRows = rows.length;
    rows = rows.slice(first, first + numRows);

    return <div>
        <div className="mb-2">
            <InputText value={search} placeholder="search" onChange={e => setSearch(e.target.value)} />
        </div>

        <DataTable value={rows} showGridlines tableStyle={{ minWidth: '50rem' }}>
            <Column field="vault" header="Vault"></Column>
            <Column field="totalSupply" header="Total Supply"></Column>
            <Column field="utilisation" header="Utilisation"></Column>
            <Column field="supplyApy" header="Supply APY"></Column>
            <Column field="borrowApy" header="Borrow APY"></Column>
        </DataTable>

        <Paginator first={first} rows={numRows} totalRecords={totalRows} rowsPerPageOptions={[10, 20, 30]} onPageChange={onPageChange} />
    </div>
}
