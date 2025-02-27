import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from "react-router-dom";

import 'primeflex/primeflex.scss';
import "primereact/resources/themes/lara-dark-purple/theme.css";
import "primereact/resources/primereact.min.css";
import '@rainbow-me/rainbowkit/styles.css';

import "./index.css";

import App from './App.jsx';

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <BrowserRouter>
            <App />
        </BrowserRouter>
    </StrictMode>,
);
