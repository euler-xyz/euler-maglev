import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useAddressScreening } from './AddressScreener';

const A = '0x000000000000000000000000000000000000000a';
const B = '0x000000000000000000000000000000000000000b';

function deferredFetch() {
    // One deferred per fetch call, resolved/rejected by the test.
    const calls = [];
    const impl = vi.fn(() => new Promise((resolve, reject) => {
        calls.push({ resolve, reject });
    }));
    vi.stubGlobal('fetch', impl);
    return { calls, impl };
}

function cleanResponse() {
    return new Response(JSON.stringify({ addressIsSuspicious: false }), { status: 200 });
}

function flaggedResponse() {
    return new Response(JSON.stringify({ addressIsSuspicious: true }), { status: 200 });
}

describe('useAddressScreening state machine', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.clearAllMocks();
    });

    it('is idle without an address and pending before a verdict', async () => {
        deferredFetch();
        const { result, rerender } = renderHook(
            ({ address }) => useAddressScreening(address),
            { initialProps: { address: undefined } },
        );
        expect(result.current.status).toBe('idle');

        rerender({ address: A });
        expect(result.current.status).toBe('pending');
    });

    it('clears only on an explicit clean verdict', async () => {
        const { calls } = deferredFetch();
        const { result } = renderHook(() => useAddressScreening(A));

        await waitFor(() => expect(calls.length).toBe(1));
        await act(async () => calls[0].resolve(cleanResponse()));
        await waitFor(() => expect(result.current.status).toBe('clear'));
    });

    it('blocks on flagged verdicts, non-ok responses, and network errors', async () => {
        for (const settle of [
            calls => calls[0].resolve(flaggedResponse()),
            calls => calls[0].resolve(new Response('{}', { status: 503 })),
            calls => calls[0].reject(new DOMException('timed out', 'TimeoutError')),
            calls => calls[0].reject(new Error('network down')),
        ]) {
            const { calls } = deferredFetch();
            const { result, unmount } = renderHook(() => useAddressScreening(A));

            await waitFor(() => expect(calls.length).toBe(1));
            await act(async () => settle(calls));
            await waitFor(() => expect(result.current.status).toBe('blocked'));
            unmount();
            vi.unstubAllGlobals();
        }
    });

    it('ignores a stale completion after switching addresses', async () => {
        const { calls } = deferredFetch();
        const { result, rerender } = renderHook(
            ({ address }) => useAddressScreening(address),
            { initialProps: { address: A } },
        );
        await waitFor(() => expect(calls.length).toBe(1));

        rerender({ address: B });
        expect(result.current.status).toBe('pending');
        await waitFor(() => expect(calls.length).toBe(2));

        // A's late FLAGGED verdict must not block B...
        await act(async () => calls[0].resolve(flaggedResponse()));
        expect(result.current.status).toBe('pending');

        // ...and B still resolves on its own verdict.
        await act(async () => calls[1].resolve(cleanResponse()));
        await waitFor(() => expect(result.current.status).toBe('clear'));
    });

    it('recovers from blocked when the address changes to a clean one', async () => {
        const { calls } = deferredFetch();
        const { result, rerender } = renderHook(
            ({ address }) => useAddressScreening(address),
            { initialProps: { address: A } },
        );
        await waitFor(() => expect(calls.length).toBe(1));
        await act(async () => calls[0].resolve(flaggedResponse()));
        await waitFor(() => expect(result.current.status).toBe('blocked'));

        rerender({ address: B });
        expect(result.current.status).toBe('pending');
        await waitFor(() => expect(calls.length).toBe(2));
        await act(async () => calls[1].resolve(cleanResponse()));
        await waitFor(() => expect(result.current.status).toBe('clear'));
    });

    it('retry() re-screens the current address after a transient failure', async () => {
        const { calls } = deferredFetch();
        const { result } = renderHook(() => useAddressScreening(A));

        await waitFor(() => expect(calls.length).toBe(1));
        await act(async () => calls[0].reject(new Error('transient')));
        await waitFor(() => expect(result.current.status).toBe('blocked'));

        act(() => result.current.retry());
        expect(result.current.status).toBe('pending');
        await waitFor(() => expect(calls.length).toBe(2));
        await act(async () => calls[1].resolve(cleanResponse()));
        await waitFor(() => expect(result.current.status).toBe('clear'));
    });
});
