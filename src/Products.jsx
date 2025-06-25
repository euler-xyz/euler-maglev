import { useState } from 'react';

import { Link, useParams, } from "react-router-dom";

import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { InputSwitch } from 'primereact/inputswitch';

import * as Lens from "./Lens";


function accumulate(accum, addend) {
    if (typeof(accum) !== 'bigint' || typeof(addend) !== 'bigint') return NaN;
    return accum + addend;
}

export function ProductsList(props) {
    let ctx = props.ctx;

    if (!ctx.ready) return ctx.loading();

    let rows = [];

    for (let productName of Object.keys(ctx.labels.raw)) {
        let product = ctx.labels.raw[productName];

        let value = 0n;
        let debtValue = 0n;

        for (let vault of product.vaults) {
            let global = ctx.vaultsGlobal[vault];

            value = accumulate(value, ctx.amountToValue(vault, global.assets));
            debtValue = accumulate(debtValue, ctx.amountToValue(vault, global.borrows));
        }

        rows.push({
            product: <Link to={`/product/${productName}`}>{productName}</Link>,
            numVaults: product.vaults.length,
            value: ctx.renderValue(value),
            debtValue: ctx.renderValue(debtValue),
        });
    }

    return <div>
        <DataTable value={rows} showGridlines tableStyle={{ minWidth: '50rem' }}>
            <Column field="product" header="Product"></Column>
            <Column field="numVaults" header="Number of Vaults"></Column>
            <Column field="value" header="Supplied"></Column>
            <Column field="debtValue" header="Borrowed"></Column>
        </DataTable>
    </div>
}


export function ProductInfo(props) {
    let ctx = props.ctx;
    let params = useParams();
    let vaults = ctx.labels?.raw[params.product].vaults;
    let [liquidationLtv, setLiquidationLtv] = useState(false);
    let [leverageMode, setLeverageMode] = useState(false);
    let { data: matrix, isPending: pending1 } = Lens.useLTVMatrix(vaults, liquidationLtv);

    if (!ctx.ready || pending1) return ctx.loading();

    let rows = [];

    {
        let row = [<th key="spacer"></th>];
        for (let vault of vaults) {
            row.push(<th className="rotated-text" key={vault}><div><Link to={`/vault/${vault}`}>{ctx.rawVaultName(vault, true)}</Link></div></th>);
        }
        rows.push(<tr key="header">{row}</tr>);
    }

    for (let i = 0; i < vaults.length; i++) {
        let row = [<th className="row-header" key="header"><Link to={`/vault/${vaults[i]}`}>{ctx.rawVaultName(vaults[i], true)}</Link></th>];

        for (let j = 0; j < vaults.length; j++) {
            let data = matrix[i][j];
            if (data === 0) {
                data = '';
            } else if (leverageMode) {
                data = 1/(1 - data);
                data = data.toFixed(2) + 'x';
            }
            row.push(<td className="cell" key={j}>{data}</td>);
        }

        rows.push(<tr className="data-row" key={i}>{row}</tr>);
    }

    return <div>
        <h1>{params.product}</h1>
        <table className="ltv-matrix">
            <tbody>
                {rows}
            </tbody>
        </table>

        <div className="flex align-items-center mt-4 ml-6">
            <div className="flex align-items-center">
                <InputSwitch checked={liquidationLtv} onChange={(e) => setLiquidationLtv(e.value)} />
                <span className="ml-3">{liquidationLtv ? 'Liquidation' : 'Borrow'} LTVs</span>
            </div>

            <div className="flex align-items-center ml-4">
                <InputSwitch checked={leverageMode} onChange={(e) => setLeverageMode(e.value)} />
                <span className="ml-3">{leverageMode ? 'Leverage' : 'LTV'}</span>
            </div>
        </div>

        <div className="flex align-items-center mt-4 ml-6">
            * Columns are liability vaults, rows are collateral vaults
        </div>
    </div>
}
