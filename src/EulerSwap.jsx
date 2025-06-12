import { useState, useRef } from 'react';
import { useAccount } from 'wagmi';
import { zeroAddress, parseUnits, formatUnits } from "viem";

import Draggable from 'react-draggable';
import useDimensions from "react-cool-dimensions";

import { AutoComplete } from "primereact/autocomplete";
import { Button } from 'primereact/button';
import { Panel } from "primereact/panel";
import { Message } from 'primereact/message';
import { Tooltip } from 'primereact/tooltip';
import { Knob } from 'primereact/knob';
import { Slider } from 'primereact/slider';
import { InputText } from 'primereact/inputtext';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { OverlayPanel } from 'primereact/overlaypanel';
import { Dialog } from 'primereact/dialog';
import { InputSwitch } from 'primereact/inputswitch';

import { useGlobalContext } from "./Ctx";
import * as Lens from "./Lens";
import * as EulerSwapUtils from "./EulerSwapUtils";


function VaultChooser(props) {
    let [value, setValue] = useState('');
    let [items, setItems] = useState([]);

    let search = (event) => {
        let re = new RegExp(event.query, "i");
        let newItems = [];

        for (let v of Object.values(props.ctx.vaultsStatic)) {
            if (v.symbol.match(re)) newItems.push(v);
        }

        setItems(newItems);
    };

    let itemTemplate = (item) => {
        return props.ctx.renderVaultName(item.vault);
    };

    let onChange = (e) => {
        setValue(e.value);
        props.onChange(e?.value?.vault);
    };

    return <AutoComplete placeholder="choose vault" field="symbol" itemTemplate={itemTemplate} value={value} suggestions={items} completeMethod={search} onChange={onChange} forceSelection dropdown />
}


function AssetChooser(props) {
    let [items, setItems] = useState([]);

    let search = (event) => {
        let re = new RegExp(event.query, "i");
        let newItems = [];

        for (let v of Object.keys(props.ctx.knownAssets)) {
            if (v.match(re)) newItems.push(v);
        }

        setItems(newItems);
    };

    let onChange = (e) => {
        props.onChange(e?.value);
    };

    return <AutoComplete placeholder="choose asset" value={props.value} suggestions={items} completeMethod={search} onChange={onChange} forceSelection dropdown />
}



function decodeRawParams(ctx, vault0, vault1, navMidpoint, rawParams, currReserves) {
    let parse18Scale = (x) => parseFloat(formatUnits(x, 18));

    let navOffset;
    if (currReserves.reserve0 < rawParams.equilibriumReserve0) navOffset = -ctx.amountToValue(vault0, rawParams.equilibriumReserve0 - currReserves.reserve0);
    else navOffset = ctx.amountToValue(vault1, rawParams.equilibriumReserve1 - currReserves.reserve1);
    navOffset = ctx.valueToNum(navOffset);

    let curveMid = navMidpoint + navOffset;
    let curveLeft = curveMid - ctx.valueToNum(ctx.amountToValue(vault1, rawParams.equilibriumReserve1));
    let curveRight = curveMid + ctx.valueToNum(ctx.amountToValue(vault0, rawParams.equilibriumReserve0));

    return {
        concentrationX: parse18Scale(rawParams.concentrationX) * 100,
        concentrationY: parse18Scale(rawParams.concentrationY) * 100,
        price: parse18Scale(scaleDecimals(ctx, vault0, vault1, EulerSwapUtils.c1e18 * rawParams.priceX / rawParams.priceY)),
        fee: parse18Scale(rawParams.fee) * 100,
        curveLeft,
        curveMid,
        curveRight,
    };
}

function pixelToFundSpace(width, domain, x) {
    let half = width / 2;
    return domain * (x - half) / half;
}

function fundSpaceToPixel(width, domain, x) {
    let half = width / 2;
    return half + (half * x / domain);
}

export function FundsSpace(props) {
    let [pos, setPos] = useState();

    let half = props.width / 2;
    let a = half * (props.from / props.domain);
    let b = half * (props.to / props.domain);

    if (a > b) [a, b] = [b, a];

    let left = a + half;

    let w = b-a;

    let style = {
        width: w,
        height: props.height || 30,
        backgroundColor: props.color,
        left: left,
        position: 'absolute',
        top: props.top,
        ...props.style,
    };

    if (props.flipped) style.transform = 'scaleX(-1)';
    if (props.background) style.background = props.background;

    if (props.mark) {
        style.width = 4;
        style.left -= 2;
        style.zIndex = 1;
    }

    return <div style={style} className="eulerswap-tooltip" data-pr-position="bottom" data-pr-tooltip={props.tooltip} />
}

function scaleDecimals(ctx, vault0, vault1, val) {
    let dec0 = 10n**(BigInt(ctx.vaultDecimals(vault0)));
    let dec1 = 10n**(BigInt(ctx.vaultDecimals(vault1)));
    return val * dec0 / dec1;
}


export function EulerSwapParamsTable(props) {
    let ctx = props.ctx;
    let params = props.params;
    let state = props.state;

    let priceNum;
    if (params.priceX !== undefined) {
        // FIXME factor
        priceNum = parseFloat(formatUnits(10n**18n * params.priceX * 10n**(BigInt(ctx.vaultDecimals(params.vault0))) / params.priceY / 10n**(BigInt(ctx.vaultDecimals(params.vault1))), 18));
    }

    let feeRendered = params.fee == undefined ? '-' : ctx.render18ScalePercent(params.fee);

    let summaryRows = [
        {
            desc: <b>Equilibrium Reserves</b>,
            v0: ctx.renderUnderlying(params.vault0, params.equilibriumReserve0),
            v1: ctx.renderUnderlying(params.vault1, params.equilibriumReserve1),
        },
        {
            desc: <b>Price at Equilibrium</b>,
            v0: priceNum === undefined ? '-' : priceNum,
            v1: priceNum === undefined ? '-' : 1/priceNum,
        },
        {
            desc: <b>Concentration</b>,
            v0: params.concentrationX === undefined ? '-' : ctx.render18ScalePercent(params.concentrationX),
            v1: params.concentrationY === undefined ? '-' : ctx.render18ScalePercent(params.concentrationY),
        },
        {
            desc: <b>LP Fee</b>,
            v0: feeRendered,
            v1: feeRendered,
        },
    ];

    if (state) {
        summaryRows.unshift({
            desc: <b>Current Reserves</b>,
            v0: state.currReserve0 === undefined ? '-' : ctx.renderUnderlying(params.vault0, state.currReserve0),
            v1: state.currReserve1 === undefined ? '-' : ctx.renderUnderlying(params.vault1, state.currReserve1),
        });
    }

    return <DataTable size="small" value={summaryRows}>
        <Column field="desc" header="" style={{ width: '20%' }}></Column>
        <Column field="v0" header={ctx.renderVaultName(params.vault0)} style={{ width: '40%' }}></Column>
        <Column field="v1" header={ctx.renderVaultName(params.vault1)} style={{ width: '40%' }}></Column>
    </DataTable>
}

export function EulerSwapViz(props) {
    let ctx = props.ctx;

    let { observe, width } = useDimensions();
    let { data: ltvPair } = Lens.useLTVPair(props.vault0, props.vault1);
    let [domain, setDomain] = useState();
    let [params, setParams] = useState();

    let [showRawDialog, setShowRawDialog] = useState(false);
    let [rawDialogSolidityMode, setRawDialogSolidityMode] = useState(false);

    let leftNodeRef = useRef(null);
    let midNodeRef = useRef(null);
    let rightNodeRef = useRef(null);

    let curveInfoOverlay = useRef(null);
    let [curveInfo, setCurveInfo] = useState();

    if (!ltvPair) return "Loading...";

    let halfWidth = width/2;

    let v0status = ctx.vaultStatus(props.vault0);
    let v1status = ctx.vaultStatus(props.vault1);

    let nav = v0status.value + v1status.value - v0status.debtValue - v1status.debtValue;
    let navNum = ctx.valueToNum(nav);

    let maxDomain = 1.05 * navNum / (1 - Math.max(ltvPair[0], ltvPair[1]));
    if (domain === undefined) setDomain(props.initialDomain || maxDomain);

    let ltv0 = -navNum / (1 - ltvPair[1]);
    let ltv1 = navNum / (1 - ltvPair[0]);


    let navMidpoint;

    if (v0status.debtValue) {
        // NAV is fully in v1
        let looped = v1status.valueNum - navNum;
        navMidpoint = (looped + navNum/2);
    } else if (v1status.debtValue) {
        // NAV is fully in v0
        let looped = v0status.valueNum - navNum;
        navMidpoint = -1 * (looped + navNum/2);
    } else {
        // NAV is in both
        navMidpoint = (-v0status.valueNum + v1status.valueNum) / 2;
    }

    let navMidpointPixel = fundSpaceToPixel(width, domain, navMidpoint);


    let loadPrice = () => {
        return ctx.vaultAssetPrice(props.vault0) / ctx.vaultAssetPrice(props.vault1);
    };

    if (!params) {
        setParams(props.initialParams ? decodeRawParams(ctx, props.vault0, props.vault1, navMidpoint, props.initialParams, props.currReserves) : {
            concentrationX: 90,
            concentrationY: 90,
            fee: 0.01,
            price: loadPrice(),
            curveLeft: ltv0,
            curveMid: 0,
            curveRight: ltv1,
        });
        return;
    }

    let setConcentrationX = (v) => setParams({ ...params, concentrationX: v });
    let setConcentrationY = (v) => setParams({ ...params, concentrationY: v });
    let setFee = (v) => setParams({ ...params, fee: v });
    let setPrice = (v) => setParams({ ...params, price: v });

    let ltv0Pixel = fundSpaceToPixel(width, domain, ltv0);
    let ltv1Pixel = fundSpaceToPixel(width, domain, ltv1);
    let curveLeftPixel = fundSpaceToPixel(width, domain, params.curveLeft);
    let curveMidPixel = fundSpaceToPixel(width, domain, params.curveMid);
    let curveRightPixel = fundSpaceToPixel(width, domain, params.curveRight);


    let onDragLeft = (e, data) => {
        let x = data.x;
        if (Math.abs(x - halfWidth) < 10) x = halfWidth;
        setParams({ ...params, curveLeft: pixelToFundSpace(width, domain, x), });
    }
    let onDragMid = (e, data) => {
        let x = data.x;
        if (Math.abs(x - navMidpointPixel) < 10) x = navMidpointPixel;
        if (Math.abs(x - halfWidth) < 10) x = halfWidth;
        setParams({ ...params, curveMid: pixelToFundSpace(width, domain, x), });
    };
    let onDragRight = (e, data) => {
        let x = data.x;
        if (Math.abs(x - halfWidth) < 10) x = halfWidth;
        setParams({ ...params, curveRight: pixelToFundSpace(width, domain, x), });
    };


    let priceParsed;
    try {
        priceParsed = parseUnits(''+params.price, 18);
        if (priceParsed === 0n) priceParsed = undefined;
    } catch (e) {}

    let feeParsed;
    try {
        feeParsed = ctx.numTo18Scale(params.fee / 100);
        if (feeParsed > EulerSwapUtils.c1e18) feeParsed = undefined;
    } catch (e) {}

    let concentrationXParsed;
    try {
        concentrationXParsed = ctx.numTo18Scale(params.concentrationX / 100);
        if (concentrationXParsed > EulerSwapUtils.c1e18) concentrationXParsed = undefined;
    } catch (e) {}

    let concentrationYParsed;
    try {
        concentrationYParsed = ctx.numTo18Scale(params.concentrationY / 100);
        if (concentrationYParsed > EulerSwapUtils.c1e18) concentrationYParsed = undefined;
    } catch (e) {}

    let paramsRaw = {
        vault0: props.vault0,
        vault1: props.vault1,
        eulerAccount: ctx.myAddr,

        equilibriumReserve0: ctx.valueToAmount(props.vault0, params.curveRight - params.curveMid),
        equilibriumReserve1: ctx.valueToAmount(props.vault1, params.curveMid - params.curveLeft),
        priceX: priceParsed === undefined ? undefined : 10n**(BigInt(ctx.vaultDecimals(props.vault1))) * priceParsed / EulerSwapUtils.c1e18,
        priceY: priceParsed === undefined ? undefined : 10n**(BigInt(ctx.vaultDecimals(props.vault0))),
        concentrationX: concentrationXParsed,
        concentrationY: concentrationYParsed,

        fee: feeParsed,
        protocolFee: 0n,
        protocolFeeRecipient: zeroAddress,
    };

    let initialStateRaw = {};

    try {
        if (Math.abs(navMidpoint - params.curveMid) < 0.0000001) {
            initialStateRaw.currReserve0 = paramsRaw.equilibriumReserve0;
            initialStateRaw.currReserve1 = paramsRaw.equilibriumReserve1;
        } else if (navMidpoint > params.curveMid) {
            initialStateRaw.currReserve0 = paramsRaw.equilibriumReserve0 - ctx.valueToAmount(props.vault0, navMidpoint - params.curveMid);
            initialStateRaw.currReserve1 = EulerSwapUtils.f(initialStateRaw.currReserve0, paramsRaw.priceX, paramsRaw.priceY, paramsRaw.equilibriumReserve0, paramsRaw.equilibriumReserve1, paramsRaw.concentrationX);
        } else {
            initialStateRaw.currReserve1 = paramsRaw.equilibriumReserve1 - ctx.valueToAmount(props.vault1, params.curveMid - navMidpoint);
            initialStateRaw.currReserve0 = EulerSwapUtils.f(initialStateRaw.currReserve1, paramsRaw.priceY, paramsRaw.priceX, paramsRaw.equilibriumReserve1, paramsRaw.equilibriumReserve0, paramsRaw.concentrationY);
        }

        if (!EulerSwapUtils.verifyOnCurveExact(initialStateRaw.currReserve0, initialStateRaw.currReserve1, paramsRaw.priceX, paramsRaw.priceY, paramsRaw.equilibriumReserve0, paramsRaw.equilibriumReserve1, paramsRaw.concentrationX, paramsRaw.concentrationY)) {
            [initialStateRaw.currReserve0, initialStateRaw.currReserve1] = EulerSwapUtils.tightenToCurve(initialStateRaw.currReserve0, initialStateRaw.currReserve1, paramsRaw.priceX, paramsRaw.priceY, paramsRaw.equilibriumReserve0, paramsRaw.equilibriumReserve1, paramsRaw.concentrationX, paramsRaw.concentrationY);
        }
    } catch(e) {
        console.warn(e);
        initialStateRaw.currReserve0 = initialStateRaw.currReserve1 = undefined;
    }


    let installEulerSwap = async () => {
        await EulerSwapUtils.deployEulerSwap(ctx, paramsRaw, initialStateRaw, props.currReserves);
        if (props.onInstall) props.onInstall();
    };

    let genVaultDisp = (vault, status, multiplier) => {
        if (status.debtValue) {
            return <FundsSpace width={width} domain={domain} color="#910000" from={0} to={multiplier * status.debtValueNum} tooltip={`${ctx.renderVaultAsset(vault)} debt:\n${ctx.renderValue(status.debtValue)}`} />
        } else {
            let looped = status.valueNum - navNum;
            return <>
                <FundsSpace width={width} domain={domain} color="#8f72a6" from={0} to={multiplier * looped} tooltip={`${ctx.renderVaultAsset(vault)} looped:\n${ctx.renderValue(status.value - nav)}`} />
                <FundsSpace width={width} domain={domain} color="#680080" from={multiplier * looped} to={multiplier * (looped+navNum)} tooltip={`NAV:\n${ctx.renderValue(nav)}`} />
            </>
        }
    };

    let priceInfoAtFundSpace = (fundSpacePoint) => {
        let o = {};

        // FIXME factor
        o.eqPrice = ctx.render18Scale(10n**18n * paramsRaw.priceX * 10n**(BigInt(ctx.vaultDecimals(paramsRaw.vault0))) / paramsRaw.priceY / 10n**(BigInt(ctx.vaultDecimals(paramsRaw.vault1))));

        if (fundSpacePoint >= 0) {
            let x = paramsRaw.equilibriumReserve0 - ctx.valueToAmount(paramsRaw.vault0, fundSpacePoint);
            if (x === 0n) return o;
            // FIXME factor
            o.xyPrice = ctx.render18Scale(-EulerSwapUtils.df_dx(x, paramsRaw.priceX, paramsRaw.priceY, paramsRaw.equilibriumReserve0, paramsRaw.concentrationX) * 10n**(BigInt(ctx.vaultDecimals(paramsRaw.vault0))) / 10n**(BigInt(ctx.vaultDecimals(paramsRaw.vault1))));
            o.yxPrice = 1/o.xyPrice;
            o.priceImpact = 1 - (o.eqPrice / o.xyPrice);
        } else {
            let x = paramsRaw.equilibriumReserve1 - ctx.valueToAmount(paramsRaw.vault1, -fundSpacePoint);
            if (x === 0n) return o;
            // FIXME factor
            o.yxPrice = ctx.render18Scale(-EulerSwapUtils.df_dx(x, paramsRaw.priceY, paramsRaw.priceX, paramsRaw.equilibriumReserve1, paramsRaw.concentrationY) * 10n**(BigInt(ctx.vaultDecimals(paramsRaw.vault1))) / 10n**(BigInt(ctx.vaultDecimals(paramsRaw.vault0))));
            o.xyPrice = 1/o.yxPrice;
            o.priceImpact = 1 - (o.xyPrice / o.eqPrice);
        }

        return o;
    };

    let handleCurveInfoMouseMove = () => {
        let bounds = event.target.parentElement.getBoundingClientRect();
        let pixelX = event.clientX - bounds.left;
        let elem = curveInfoOverlay.current.getElement();
        if (elem) elem.style.left = `${pixelX}px`;

        let fundSpacePoint = pixelToFundSpace(width, domain, pixelX);

        let priceInfo = priceInfoAtFundSpace(fundSpacePoint - params.curveMid);

        setCurveInfo(<div>
            <div>
                Impact: {(priceInfo.priceImpact * 100).toFixed(2)}%
            </div>

            <div>
                {ctx.renderVaultAsset(props.vault0)}/{ctx.renderVaultAsset(props.vault1)}: {priceInfo.xyPrice}
            </div>

            <div>
                {ctx.renderVaultAsset(props.vault1)}/{ctx.renderVaultAsset(props.vault0)}: {priceInfo.yxPrice}
            </div>
        </div>);
    };

    let genGradient = (size) => {
        if (size === 0n) return '';
        if (size > 0n && paramsRaw.concentrationX === undefined) return 'orange';
        if (size < 0n && paramsRaw.concentrationY === undefined) return 'orange';
        if (!paramsRaw.priceX || !paramsRaw.priceY) return 'orange';

        let divisions = 10;

        let o = `linear-gradient(89deg, #ffffff 0%`;

        for (let i = 0; i < divisions - 1; i++) {
            let priceInfo = priceInfoAtFundSpace(size * (i+1) / divisions);
            let impact = priceInfo.priceImpact;
            let colour = (255 - Math.floor(impact * 255)).toString(16).padStart(2, '0');
            o += `, #ff${colour}${colour} ${100 * (i+1) / divisions}%`;
        }

        o += `, #f00 100%)`;

        return o;
    };

    function renderRawParams() {
        let o = { ...paramsRaw, };
        for (let k of Object.keys(o)) {
            if (typeof(o[k]) === 'bigint') o[k] = o[k].toString();
        }

        let str = JSON.stringify(o, ' ', 4);
        if (rawDialogSolidityMode) str = str.replaceAll('"', '');

        return <div>
            Params:
            <pre>{str}</pre>
        </div>
    }

    return <div>
        <Tooltip target=".eulerswap-tooltip" />

        {!props.viewMode && <div>
            <div className="flex align-items-center justify-content-around">
                <div className="field">
                    <label htmlFor="cx-input">Concentration X</label>
                    <div>
                        <div className="p-inputgroup flex-1">
                            <InputText id="cx-input" value={params.concentrationX} onChange={(e) => setConcentrationX(parseFloat(e.target.value))} />
                            <span className="p-inputgroup-addon">%</span>
                        </div>
                        <Slider value={params.concentrationX} onChange={(e) => setConcentrationX(e.value)} min={0} max={99.999999} step={0.01} />
                    </div>
                </div>

                <div className="field">
                    <label htmlFor="cy-input">Concentration Y</label>
                    <div>
                        <div className="p-inputgroup flex-1">
                            <InputText id="cy-input" value={params.concentrationY} onChange={(e) => setConcentrationY(parseFloat(e.target.value))} />
                            <span className="p-inputgroup-addon">%</span>
                        </div>
                        <Slider value={params.concentrationY} onChange={(e) => setConcentrationY(e.value)} min={0} max={99.999999} step={0.01} />
                    </div>
                </div>
            </div>

            <div className="flex align-items-center justify-content-around">
                <div className="field">
                    <label htmlFor="fee-input">Fee</label>
                    <div>
                        <div className="p-inputgroup flex-1">
                            <InputText id="fee-input" value={params.fee} onChange={(e) => setFee(parseFloat(e.target.value))} />
                            <span className="p-inputgroup-addon">%</span>
                        </div>
                        <Slider value={params.fee} onChange={(e) => setFee(e.value)} min={0} max={3} step={0.01} />
                    </div>
                </div>

                <div className="field">
                    <label htmlFor="price-input">Price at Equilibrium</label>
                    <div className="p-inputgroup flex-1">
                        <span className="p-inputgroup-addon">{ctx.renderVaultAsset(props.vault0)}/{ctx.renderVaultAsset(props.vault1)}</span>
                        <InputText id="price-input" value={params.price} onChange={(e) => setPrice(e.target.value)} />
                        <Button label="⟳" onClick={() => setPrice(loadPrice())} />
                    </div>
                </div>
            </div>
        </div>}


        <div className="flex mt-6" ref={observe} style={{ marginTop: 10, width: '100%', position: 'relative', overflowX: 'clip', height: 140 }}>
            <FundsSpace width={width} domain={domain} color="white" from={ltv0} to={ltv0} mark tooltip={`${ctx.renderVaultAsset(props.vault0)}/${ctx.renderVaultAsset(props.vault1)} max LTV`} />
            <FundsSpace width={width} domain={domain} color="white" from={ltv1} to={ltv1} mark tooltip={`${ctx.renderVaultAsset(props.vault1)}/${ctx.renderVaultAsset(props.vault0)} max LTV`} />

            {genVaultDisp(props.vault0, v0status, -1)}
            {genVaultDisp(props.vault1, v1status, 1)}
            <FundsSpace width={width} domain={domain} color="green" from={navMidpoint} to={navMidpoint} mark tooltip="NAV mid-point" />

            <div onMouseMove={handleCurveInfoMouseMove} onMouseOver={e => curveInfoOverlay.current.show(e)} onMouseOut={e => curveInfoOverlay.current.hide(e)}>
                <FundsSpace width={width} domain={domain} background={genGradient(params.curveLeft - params.curveMid)} from={params.curveLeft} to={params.curveMid} top={60} flipped />
                <FundsSpace width={width} domain={domain} background={genGradient(params.curveRight - params.curveMid)} from={params.curveRight} to={params.curveMid} top={60} />
            </div>


            <FundsSpace width={width} domain={domain} from={params.curveMid} to={params.curveMid} height={90} mark style={{ border: '3px dotted #7ab5ff',}} tooltip="Curve Equilibrium" />

            {!props.viewMode && <Draggable nodeRef={leftNodeRef} axis="x" position={{ x: curveLeftPixel, y: 0, }} bounds={{ left: ltv0Pixel, right: Math.min(curveMidPixel, navMidpointPixel), }} onDrag={onDragLeft}>
                <div ref={leftNodeRef} style={{ marginTop: 62.5, fontSize: 20, marginLeft: -20, }}>
                    <span style={{ backgroundColor: 'blue', borderRadius: 5 }}>&#x21c6;</span>
                </div>
            </Draggable>}

            {!props.viewMode && <Draggable nodeRef={midNodeRef} axis="x" position={{ x: curveMidPixel, y: 0, }} bounds={{ left: curveLeftPixel, right: curveRightPixel, }} onDrag={onDragMid}>
                <div ref={midNodeRef} style={{ marginTop: 90, fontSize: 20, marginLeft: -5, }}>
                    <span style={{ backgroundColor: 'blue', borderRadius: 5 }}>&#9878;</span>
                </div>
            </Draggable>}

            {!props.viewMode && <Draggable nodeRef={rightNodeRef} axis="x" position={{ x: curveRightPixel, y: 0, }} bounds={{ left: Math.max(curveMidPixel, navMidpointPixel), right: ltv1Pixel, }} onDrag={onDragRight}>
                <div ref={rightNodeRef} style={{ marginTop: 62.5, fontSize: 20, }}>
                    <span style={{ backgroundColor: 'blue', borderRadius: 5 }}>&#x21c6;</span>
                </div>
            </Draggable>}
        </div>
        <Slider value={domain} onChange={(e) => setDomain(e.value)} min={0} max={maxDomain} step={maxDomain / 1000} />
        <OverlayPanel ref={curveInfoOverlay}>{curveInfo}</OverlayPanel>

        <div className="mt-6">
            <EulerSwapParamsTable ctx={ctx} params={paramsRaw} state={initialStateRaw} />
        </div>

        {!props.viewMode && <div className="mt-6 flex align-items-center justify-content-center">
            <Button className="mr-6" label="Install" onClick={installEulerSwap} />
            <Button className="mr-6" label="Show Raw" onClick={() => setShowRawDialog(true)} />
        </div>}

        <Dialog header="Header" visible={showRawDialog} style={{ width: '90vw' }} onHide={() => {if (!showRawDialog) return; setShowRawDialog(false); }}>
            {renderRawParams()}
            Solidity mode: <InputSwitch checked={rawDialogSolidityMode} onChange={(e) => setRawDialogSolidityMode(e.value)} />
        </Dialog>
    </div>
}


export function VaultPairChooser(props) {
    let ctx = props.ctx;

    let [vault0, setVault0] = useState(undefined);
    let [vault1, setVault1] = useState(undefined);

    let error;

    if (vault0 && vault0 === vault1) error = "Vaults are the same";

    let onChoose = () => {
        let sortedVault0 = vault0;
        let sortedVault1 = vault1;
        if (BigInt(ctx.vaultsStatic[vault0].asset) > BigInt(ctx.vaultsStatic[vault1].asset)) [sortedVault0, sortedVault1] = [sortedVault1, sortedVault0];
        props.onChoose(sortedVault0, sortedVault1);
    };

    return <div className="mt-6">
        <div className="flex gap-6">
            <VaultChooser ctx={ctx} onChange={setVault0} />
            <VaultChooser ctx={ctx} onChange={setVault1} />
            <Button disabled={error || !vault0 || !vault1} onClick={onChoose}>Configure</Button>
        </div>

        { error && <Message severity="error" text={error} className="mt-4" /> }
    </div>
}


export function EulerSwapPanel(props) {
    let ctx = props.ctx;

    let { data: myEulerSwap } = Lens.useMyEulerSwap(ctx.myAddr);
    let [uiState, setUiState] = useState('default');
    let [vaults, setVaults] = useState();

    if (!myEulerSwap || !ctx.ready) return "Loading...";

    let existing = myEulerSwap.addr === zeroAddress ? undefined : myEulerSwap.addr;
    let currReserves = { reserve0: myEulerSwap.reserve0, reserve1: myEulerSwap.reserve1, };

    let onChooseVaults = (vault0, vault1) => {
        setVaults([vault0, vault1]);
        setUiState('edit');
    };

    let onInstall = () => {
        setUiState('default');
    };

    let doUninstall = async () => {
        await EulerSwapUtils.uninstallEulerSwap(ctx);
    };

    let doEdit = () => {
        setVaults([myEulerSwap.params.vault0, myEulerSwap.params.vault1]);
        setUiState('edit');
    };

    return <Panel header="EulerSwap" className="mt-6">
        <div className="flex justify-content-evenly mt-4">
            {uiState === 'default' && <>
                <Button label="New" onClick={() => setUiState('new-choose-vaults')} />
                {existing && <Button label="Edit" onClick={doEdit} />}
                {existing && <Button label="Uninstall" onClick={doUninstall} />}
            </>}

            {uiState !== 'default' && <>
                <Button label="Cancel" onClick={() => setUiState('default')} />
            </>}
        </div>

        {uiState === 'default' && existing && <div style={{ width: '100%', }}>
            <EulerSwapViz ctx={props.ctx} viewMode vault0={myEulerSwap.params.vault0} vault1={myEulerSwap.params.vault1} initialParams={myEulerSwap.params} currReserves={currReserves} />
        </div>}

        {uiState === 'new-choose-vaults' && <VaultPairChooser ctx={ctx} onChoose={onChooseVaults} />}

        {uiState === 'edit' && <div style={{ width: '100%', }}>
            <EulerSwapViz ctx={props.ctx} vault0={vaults[0]} vault1={vaults[1]} initialParams={existing && myEulerSwap.params} currReserves={existing && currReserves} onInstall={onInstall} />
        </div>}
    </Panel>
}










export function EulerSwapBrowse(props) {
    let ctx = useGlobalContext(1, 0);

    let [assetA, setAssetA] = useState();
    let [assetB, setAssetB] = useState();
    let [swapAmount, setSwapAmount] = useState('');
    let [slippage, setSlippage] = useState(0);
    let [exactIn, setExactIn] = useState(true);

    let { data: eulerSwapData } = Lens.useEulerSwapData();

    let assetAInfo = assetA && ctx.knownAssets[assetA];
    let assetBInfo = assetB && ctx.knownAssets[assetB];

    let { data: allowance } = Lens.useAllowance(assetAInfo?.addr, ctx.myPrimaryAddr, ctx.currChain?.addresses.eulerSwapAddrs.eulerSwapPeriphery);

    let swapAmountParsed;
    if (assetAInfo && assetBInfo && swapAmount) {
        try {
            let decimals = (exactIn ? assetAInfo : assetBInfo).decimals;
            swapAmountParsed = parseUnits(swapAmount, decimals);
        } catch(e) {
        }
    }

    let slip = parseFloat(slippage);
    if (isNaN(slip) || slip < 0 || slip > 100) {
        slip = undefined;
    } else {
        slip /= 100;
        slip = EulerSwapUtils.c1e18 - parseUnits(slip.toString(), 18);
    }

    let { data: eulerSwapQuotes } = Lens.useEulerSwapQuoteMulti(ctx, eulerSwapData && eulerSwapData.map(e => e.addr), assetA, assetB, swapAmountParsed, exactIn);

    if (!eulerSwapData || !ctx.ready) return "Loading...";

    let swapReady = slip !== undefined && (!ctx.connected || allowance !== undefined);

    let rows = [];

    let doSwap = async (eulerSwap, quote) => {
        let tokenIn = ctx.knownAssets[assetA].addr;
        let tokenOut = ctx.knownAssets[assetB].addr;

        if (exactIn) {
            await EulerSwapUtils.doSwapExactIn(ctx, eulerSwap.addr, tokenIn, tokenOut, swapAmountParsed, quote);
        } else {
            await EulerSwapUtils.doSwapExactOut(ctx, eulerSwap.addr, tokenIn, tokenOut, swapAmountParsed, quote);
        }
    };

    let doApprove = async (approveAmount) => {
        await EulerSwapUtils.doApprove(ctx, assetAInfo?.addr, ctx.currChain?.addresses.eulerSwapAddrs.eulerSwapPeriphery, approveAmount);
    };

    for (let i = 0; i < eulerSwapData.length; i++) {
        let e = eulerSwapData[i];

        if (assetAInfo && e.asset0 !== assetAInfo.addr && e.asset1 !== assetAInfo.addr) continue;
        if (assetBInfo && e.asset0 !== assetBInfo.addr && e.asset1 !== assetBInfo.addr) continue;

        let row = {
            vault0: ctx.renderVaultName(e.params.vault0),
            vault1: ctx.renderVaultName(e.params.vault1),

            amount0: ctx.renderUnderlying(e.params.vault0, e.outLimit10),
            amount1: ctx.renderUnderlying(e.params.vault1, e.outLimit01),
        };

        if (eulerSwapQuotes && eulerSwapQuotes[i] && swapReady) {
            let quote;
            if (exactIn) quote = eulerSwapQuotes[i] * slip / EulerSwapUtils.c1e18;
            else quote = EulerSwapUtils.c1e18 * eulerSwapQuotes[i] / slip;

            let quoteAsset = (exactIn ? assetBInfo : assetAInfo).addr;
            let quoteVault = e.asset0 === quoteAsset ? e.params.vault0 : e.params.vault1;

            row.q = quote;
            row.quote = <span className="font-bold">{ctx.renderUnderlying(quoteVault, quote)}</span>;

            if (!ctx.connected) {
                row.swap = <Button disabled>Swap</Button>;
            } else if (swapAmountParsed > allowance) {
                row.swap = <Button onClick={() => doApprove(exactIn ? swapAmountParsed : quote)}>Approve</Button>;
            } else {
                row.swap = <Button onClick={() => doSwap(e, quote)}>Swap</Button>;
            }
        }

        rows.push(row);
    }

    let bigintSign = n => n < 0n ? -1 : n > 0n ? 1 : 0;
    if (exactIn) rows.sort((a,b) => bigintSign(b.q - a.q));
    else rows.sort((a,b) => bigintSign(a.q - b.q));

    let amountInput = () => {
        return <div className="field">
            <label htmlFor="swap-amount-input">Amount {exactIn ? 'In' : 'Out'}</label>
            <div>
                <InputText id="swap-amount-input" value={swapAmount} onChange={(e) => setSwapAmount(e.target.value)} />
            </div>
        </div>
    };

    let slippageInput = () => {
        return <div className="field">
            <label htmlFor="slippage-input">Slippage</label>
            <div className="p-inputgroup flex-1">
                <InputText id="slippage-input" value={slippage} onChange={(e) => setSlippage(e.target.value)} />
                <span className="p-inputgroup-addon">%</span>
            </div>
        </div>
    };

    let swapAssets = () => {
        setAssetA(assetB);
        setAssetB(assetA);
    };

    return <div>
        <div>
            <div className="grid">
                <div className="col">
                    <AssetChooser ctx={ctx} value={assetA} onChange={setAssetA} />
                </div>
                <div className="col text-center">
                    <Button onClick={swapAssets}>&#x21d2;</Button>
                </div>
                <div className="col">
                    <AssetChooser ctx={ctx} value={assetB} onChange={setAssetB} />
                </div>
            </div>

            <div className="grid align-items-center mt-4">
                <div className="col">
                    {exactIn ? amountInput() : slippageInput()}
                </div>

                <div className="col text-center">
                    <Button onClick={() => setExactIn(!exactIn)}>Exact {exactIn ? 'In' : 'Out'}</Button>
                </div>

                <div className="col">
                    {!exactIn ? amountInput() : slippageInput()}
                </div>
            </div>
        </div>

        <DataTable value={rows}>
            <Column field="vault0" header="Vault 0"></Column>
            <Column field="amount0" header="Available 0"></Column>
            <Column field="vault1" header="Vault 1"></Column>
            <Column field="amount1" header="Available 1"></Column>
            <Column field="quote" header="Quote"></Column>
            <Column field="swap" header="Swap"></Column>
        </DataTable>
    </div>
}
