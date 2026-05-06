import { useEffect } from 'react';

async function detectVpn() {
    try {
        let resp = await fetch(window.location.origin, { method: "HEAD" });
        let header = resp.headers.get("x-is-vpn");

        return header?.toLowerCase() === "true";
    } catch (err) {
        console.warn("[VPN] Detection failed. Defaulting to false", err);
    }

    return false;
}

export function useAddressChecker(address, setSuspicious) {
    useEffect(() => {
        if (!address) return;

        let fetchAddressInfo = async () => {
            try {
                let vpnIsUsed = await detectVpn();

                let response = await fetch('https://data.euler.finance/trm-address-checker', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        address,
                        chain: 'all',
                        vpnIsUsed,
                    }),
                });

                let data = await response.json();

                if (data.addressIsSuspicious) {
                    console.warn('[TRM] address flagged', data);
                    setSuspicious(true);
                }
            } catch (err) {
                console.warn("[TRM] Failed to check address", err);
            }
        };

        fetchAddressInfo();
    }, [address]);
}
