import { useState } from 'react';

import { getDefaultConfig, RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { WagmiProvider, useChainId, useSwitchChain } from 'wagmi';
import { foundry, } from 'wagmi/chains';
import { QueryClientProvider, QueryClient, } from "@tanstack/react-query";
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Route, Routes, Link, NavLink } from "react-router-dom";
import { Tooltip as ReactTooltip } from 'react-tooltip';

import { Dropdown } from 'primereact/dropdown';

import { useGlobalContext } from "./Ctx";
import { getWagmiChainConfigs } from './ChainConfig';
import { VaultList, VaultInfo } from './Vaults';
import { ProductsList, ProductInfo } from './Products';
import { AccountPanel } from './Account';
import { EulerSwapBrowse, EulerSwapShowInstance } from './EulerSwap';
import { ContractErrorMessage } from "./ErrorBoundary";


const wagmiConfig = getDefaultConfig({
    appName: 'Euler Maglev',
    projectId: '391e81aa5e25cbeb2c39a02b0b3f30d4', // FIXME this phones home to walletconnect !?
    chains: getWagmiChainConfigs(),
});

const queryClient = new QueryClient();




function Header(props) {
    let { chains, switchChain } = useSwitchChain();
    let myChainId = useChainId();

    return <div className="header-bar">
        <Link to={`/`}>
            <div className="logo">
                Euler Maglev
                <img style={{ marginLeft: 20, height: 75, }} src="/maglev.png" />
            </div>
        </Link>

        <div className="flex align-items-center">
            {!props.ctx.connected && <Dropdown value={myChainId} onChange={e => switchChain({ chainId: e.value, })} options={chains} optionLabel="name" optionValue="id" />}

            <div className="ml-2 connectButtonContainer"><ConnectButton/></div>
        </div>
    </div>
}

function Main() {
    let [currSubAccount, setCurrSubAccount] = useState(0);
    let [numSubAccounts, setNumSubAccounts] = useState(3);
    let [extraVaultAddrs, setExtraVaultAddrs] = useState({});

    let ctx = useGlobalContext({
        currSubAccount, setCurrSubAccount,
        numSubAccounts, setNumSubAccounts,
        extraVaultAddrs, setExtraVaultAddrs,
    });

    return <div className="main">
        <Header ctx={ctx} />

        <div className="header-links">
            <NavLink to={`/euler-swap/`}>Swap</NavLink>
            <NavLink to={`/vaults/`}>Vaults</NavLink>
            <NavLink to={`/products/`}>Products</NavLink>
            <NavLink to={`/account/`}>Account</NavLink>
        </div>

        <Routes>
            <Route path="/" element={<EulerSwapBrowse ctx={ctx} />} />

            <Route path="/vaults/" element={<VaultList ctx={ctx} />} />
            <Route path="/vault/:vault" element={<VaultInfo ctx={ctx} />} />

            <Route path="/products/" element={<ProductsList ctx={ctx} />} />
            <Route path="/product/:product" element={<ProductInfo ctx={ctx} />} />

            <Route path="/account/" element={<AccountPanel ctx={ctx} />} />
            <Route path="/euler-swap/" element={<EulerSwapBrowse ctx={ctx} />} />
            <Route path="/euler-swap/:account" element={<EulerSwapShowInstance ctx={ctx} />} />
        </Routes>

        <ReactTooltip id="maglev-tooltip" clickable style={{ backgroundColor: "#484646", color: "white", top: -50 }} />
    </div>
}

function App() {
    return (
        <WagmiProvider config={wagmiConfig}>
            <QueryClientProvider client={queryClient}>
                <RainbowKitProvider theme={darkTheme()}>
                    <Main />
                </RainbowKitProvider>
            </QueryClientProvider>
        </WagmiProvider>
    );
}

export default App;
