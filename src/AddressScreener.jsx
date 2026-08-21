import { useCallback, useEffect, useState } from 'react';

// Address screening goes through the euler-lite server proxy, which holds
// the compliance API key (this app has no server of its own). The screening
// vendor is an upstream implementation detail — this app only sees the
// neutral `{ addressIsSuspicious }` contract. The VPN flag is derived
// server-side from edge-set headers, so the body only carries the address.
const SCREENING_ENDPOINT = import.meta.env.VITE_SCREENING_URI
    ?? 'https://app.euler.finance/api/internal/screen-address';

const SCREENING_TIMEOUT_MS = 15000;

// Screening state machine, keyed to the address it was measured for:
//   'idle'    — no address connected, nothing to screen
//   'pending' — verdict not yet known; callers must not treat this as clear
//   'clear'   — explicit clean verdict for the current address
//   'blocked' — flagged, or any failure (fail-closed)
//
// Results are bound to the address that requested them: a change of address
// cancels the in-flight check (via the effect cleanup) and restarts from
// 'pending', so a delayed verdict for a previous address can neither block
// nor clear the current one — and a blocked state is dropped the moment the
// address changes, recovering automatically on a later clean account.
//
// `retry()` re-runs the check for the current address, so a transient
// failure (timeout, 429/5xx, network blip) has an in-app recovery path
// while actions stay gated.
export function useAddressScreening(address) {
    const [state, setState] = useState({ address: undefined, status: 'idle' });
    const [attempt, setAttempt] = useState(0);

    const retry = useCallback(() => setAttempt(a => a + 1), []);

    useEffect(() => {
        if (!address) {
            setState({ address: undefined, status: 'idle' });
            return;
        }

        let cancelled = false;
        setState({ address, status: 'pending' });

        const screen = async () => {
            try {
                const response = await fetch(SCREENING_ENDPOINT, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ address }),
                    signal: AbortSignal.timeout(SCREENING_TIMEOUT_MS),
                });

                if (cancelled) return;

                if (!response.ok) {
                    setState({ address, status: 'blocked' });
                    return;
                }

                const data = await response.json();
                if (cancelled) return;

                setState({
                    address,
                    status: data?.addressIsSuspicious === false ? 'clear' : 'blocked',
                });
            } catch (err) {
                if (cancelled) return;
                console.warn("Screening check failed — failing closed", err);
                setState({ address, status: 'blocked' });
            }
        };

        screen();

        return () => { cancelled = true; };
    }, [address, attempt]);

    let status;
    if (!address) {
        status = 'idle';
    } else {
        // Guard against render-before-effect and any state carried over from
        // a previous address: only a verdict measured for this address counts.
        status = state.address === address ? state.status : 'pending';
    }

    return { status, retry };
}
