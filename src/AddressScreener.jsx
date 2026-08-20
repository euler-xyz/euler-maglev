import { useEffect } from 'react';

// Address screening goes through the euler-lite server proxy, which holds
// the compliance API key (this app has no server of its own). The screening
// vendor is an upstream implementation detail — this app only sees the
// neutral `{ addressIsSuspicious }` contract. The VPN flag is derived
// server-side from edge-set headers, so the body only carries the address.
const SCREENING_ENDPOINT = import.meta.env.VITE_SCREENING_URI
    ?? 'https://app.euler.finance/api/public/screen-address';

const SCREENING_TIMEOUT_MS = 15000;

// Fail-closed: a failed or timed-out screening call blocks exactly like a
// flagged address, and only an explicit `false` verdict clears it.
export function useAddressChecker(address, setSuspicious) {
    useEffect(() => {
        if (!address) return;

        let fetchAddressInfo = async () => {
            try {
                let response = await fetch(SCREENING_ENDPOINT, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ address }),
                    signal: AbortSignal.timeout(SCREENING_TIMEOUT_MS),
                });

                if (!response.ok) {
                    setSuspicious(true);
                    return;
                }

                let data = await response.json();

                if (data?.addressIsSuspicious !== false) {
                    setSuspicious(true);
                }
            } catch (err) {
                console.warn("Screening check failed — failing closed", err);
                setSuspicious(true);
            }
        };

        fetchAddressInfo();
    }, [address]);
}
