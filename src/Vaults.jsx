import { useState } from 'react';
import { Link, useParams, } from "react-router-dom";

import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { TabMenu } from 'primereact/tabmenu';
import { Chip } from 'primereact/chip';
import { Card } from 'primereact/card';
import { InputText } from 'primereact/inputtext';
import { Paginator } from 'primereact/paginator';
import { Chart } from 'primereact/chart';

import * as Lens from "./Lens";


const c1e18 = 10n**18n;


function renderUtilisation(ctx, global) {
    return ctx.render18ScalePercent(global.assets ? global.borrows * c1e18 / global.assets : 0);
}


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

        rows.push({
            vault: <div className="flex align-items-center">
                {ctx.renderVaultName(vaultAddr)}
            </div>,
            totalSupply: ctx.renderUnderlying(vaultAddr, global.assets),
            utilisation: renderUtilisation(ctx, global),
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



function FeeDistributionPieChart(props) {
    let configScaleToPercentage = (s) => s * 100 / 1e4;

    let protocolShare = props.vaultDetailed.interestFee * Number(props.vaultDetailed.protocolFeeShare) / 1e4;
    let governorShare = props.vaultDetailed.interestFee - protocolShare;

    const documentStyle = getComputedStyle(document.documentElement);
    const data = {
        labels: ['Depositors', 'Governor', 'Protocol'],
        datasets: [
            {
                data: [
                    configScaleToPercentage(1e4 - props.vaultDetailed.interestFee),
                    configScaleToPercentage(governorShare),
                    configScaleToPercentage(protocolShare),
                ],
            }
        ]
    }
    const options = {
        plugins:{         
          datalabels: {
            color: 'white',
            formatter: function(value, context) {                  
              return Math.round(value/context.chart.getDatasetMeta(0).total * 100) + "%" ;
            }
          }
        }
    };

    return (
        <div className="flex justify-content-center">
            <Chart type="pie" data={data} options={options} className="w-full md:w-30rem" />
        </div>
    )
}



function decodeCap(cap) {
    cap = Number(cap);
    if (cap === 0) return undefined;

    return (10n ** BigInt(cap & 63)) * BigInt(cap >> 6) / 100n;
}


export function VaultInfo(props) {
    let ctx = props.ctx;
    let params = useParams();

    let { data: vaultsDetailed } = Lens.useVaultsDetailed([params.vault]);

    if (!ctx.ready || !vaultsDetailed) return 'Loading...';
    if (!ctx.addExtraVaults({ [params.vault]: true, })) return 'Loading...';

    let vaultGlobal = ctx.vaultsGlobal[params.vault];
    let vaultStatic = ctx.vaultsStatic[params.vault];
    let irs = ctx.getIRs(params.vault);
    let vaultDetailed = vaultsDetailed[0];

    let unitOfAccount = vaultDetailed.unitOfAccount;

    if (unitOfAccount === '0x0000000000000000000000000000000000000348') unitOfAccount = 'USD';
    else if (unitOfAccount === '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB') unitOfAccount = 'BTC';
    else unitOfAccount = ctx.etherscanAddress(unitOfAccount, unitOfAccount);

    let overviewRows = [
        {
            attr: 'Underlying Asset',
            value: ctx.etherscanAddress(vaultStatic.asset, ctx.renderVaultAsset(params.vault)),
        },
        {
            attr: 'Vault Address',
            value: ctx.etherscanAddress(params.vault, params.vault),
        },
        {
            attr: 'Governor',
            value: ctx.etherscanAddress(vaultDetailed.governorAdmin, vaultDetailed.governorAdmin),
        },
        {
            attr: 'Interest Rate Model',
            value: ctx.etherscanAddress(vaultDetailed.interestRateModel, vaultDetailed.interestRateModel),
        },
        {
            attr: 'Oracle',
            value: ctx.etherscanAddress(vaultDetailed.oracle, vaultDetailed.oracle),
        },
        {
            attr: 'Unit Of Account',
            value: unitOfAccount,
        },
        {
            attr: 'Debt Token',
            value: ctx.etherscanAddress(vaultDetailed.dToken, vaultDetailed.dToken),
        },
    ];

    let statsRows = [
        {
            attr: 'Total Supply',
            value: ctx.renderUnderlying(params.vault, vaultGlobal.assets),
        },
        {
            attr: 'Total Borrows',
            value: ctx.renderUnderlying(params.vault, vaultGlobal.borrows),
        },
        {
            attr: 'Utilisation',
            value: renderUtilisation(ctx, vaultGlobal),
        },
        {
            attr: 'Supply APY',
            value: <div>{(irs.supplyAPY * 100).toFixed(3)}%</div>,
        },
        {
            attr: 'Borrow APY',
            value: <div>{(irs.borrowAPY * 100).toFixed(3)}%</div>,
        },
    ];

    let supplyCap = decodeCap(vaultGlobal.supplyCap);
    let borrowCap = decodeCap(vaultGlobal.borrowCap);
    let badDebtSocialisation = !(vaultDetailed.configFlags & (1 << 0));

    let riskRows = [
        {
            attr: 'Supply Cap',
            value: supplyCap === undefined ? 'Unlimited' : ctx.renderUnderlying(params.vault, supplyCap),
        },
        {
            attr: 'Borrow Cap',
            value: borrowCap === undefined ? 'Unlimited' : ctx.renderUnderlying(params.vault, borrowCap),
        },
        {
            attr: 'Max Liquidation Discount',
            value: (100 * vaultDetailed.maxLiquidationDiscount / 1e4) + '%',
        },
        {
            attr: 'Liquidation Cool-Off Time',
            value: `${vaultDetailed.liquidationCoolOffTime} seconds`,
        },
        {
            attr: 'Bad Debt Socialisation',
            value: badDebtSocialisation ? 'Yes' : 'No',
        },
    ];

    let feesRows = [
        {
            attr: 'Interest Fee',
            value: (100 * vaultDetailed.interestFee / 1e4) + '%',
        },
        {
            attr: 'Protocol Fee Share',
            value: (100 * Number(vaultDetailed.protocolFeeShare) / 1e4) + '% of Interest Fee',
        },
        {
            attr: 'Accumulated Fees',
            value: ctx.renderShares(params.vault, vaultDetailed.accumulatedFees),
        },
        {
            attr: 'Governor Fee Receiver',
            value: ctx.etherscanAddress(vaultDetailed.feeReceiver, vaultDetailed.feeReceiver),
        },
        {
            attr: 'Protocol Fee Receiver',
            value: ctx.etherscanAddress(vaultDetailed.protocolFeeReceiver, vaultDetailed.protocolFeeReceiver),
        },
    ];

    let miscRows = [
        {
            attr: 'Creator',
            value: ctx.etherscanAddress(vaultDetailed.creator, vaultDetailed.creator),
        },
        {
            attr: 'Hook Target',
            value: ctx.etherscanAddress(vaultDetailed.hookTarget, vaultDetailed.hookTarget),
        },
        {
            attr: 'Hooked Ops (bitfield)',
            value: vaultDetailed.hookedOps,
        },
    ];


    let Section = (props) => <Card key={props.header} header={props.header} className="vault-details-card">
        {props.children}
    </Card>;

    let Table = (props) => (
        <table className="vault-details-table">
            <tbody>
                {props.rows.map(row => <tr key={row.attr}>
                    <td className="attr">{row.attr}</td>
                    <td className="value">{row.value}</td>
                </tr>)}
            </tbody>
        </table>
    );

    return <div>
        <h1 className="ml-4">{ctx.renderVaultName(params.vault)}</h1>

        <Section header="Overview">
            <Table rows={overviewRows} />
        </Section>

        <Section header="Statistics">
            <Table rows={statsRows} />
        </Section>

        <Section header="Risk Parameters">
            <Table rows={riskRows} />
        </Section>

        <Section header="Fees">
            <Table rows={feesRows} />

            <div className="mt-6">
                <FeeDistributionPieChart vaultDetailed={vaultDetailed} />
            </div>
        </Section>

        <Section header="Misc">
            <Table rows={miscRows} />
        </Section>
    </div>
}
