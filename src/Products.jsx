import { useState } from 'react';

import { Link, useParams, } from "react-router-dom";

import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { InputSwitch } from 'primereact/inputswitch';

import * as Lens from "./Lens";



export function ProductsList(props) {
    let ctx = props.ctx;

    if (!ctx.ready) return "Loading...";

    let rows = [];

    for (let productName of Object.keys(ctx.labels.raw)) {
        let product = ctx.labels.raw[productName];

        let value = 0n;
        let debtValue = 0n;

        for (let vault of product.vaults) {
            let status = ctx.vaultStatus(vault);
            value += status.value;
            debtValue += status.debtValue;
        }

        rows.push({
            product: <Link to={`/products/${productName}`}>{productName}</Link>,
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
    let { data: borrowMatrix, isPending: pending1 } = Lens.useLTVMatrix(vaults, liquidationLtv);

    if (!ctx.ready || pending1) return "Loading...";

    let rows = [];

    {
        let row = [<th key="spacer"></th>];
        for (let vault of vaults) {
            row.push(<th className="rotated-text" key={vault}><div><span>{ctx.rawVaultName(vault, true)}</span></div></th>);
        }
        rows.push(<tr key="header">{row}</tr>);
    }

    for (let i = 0; i < vaults.length; i++) {
        let row = [<th className="row-header" key="header">{ctx.rawVaultName(vaults[i], true)}</th>];

        for (let j = 0; j < vaults.length; j++) {
            row.push(<td className="cell" key={j}>{borrowMatrix[(i*vaults.length) + j]}</td>);
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

        <div className="flex align-items-center mt-4">
            <InputSwitch checked={liquidationLtv} onChange={(e) => setLiquidationLtv(e.value)} />
            <span className="ml-3">{liquidationLtv ? 'Liquidation' : 'Borrow'} LTVs</span>
        </div>
    </div>
}
