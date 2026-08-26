import { useState, useEffect, useRef } from 'react';
import { apiGet, apiPost, apiDelete, errorMessage } from '../api';
import { useRefresh } from '../refresh';

// /watchlist costs ~2s per symbol on the IB event loop, so poll it far less
// often than the shared 5s tick: 6 ticks ~= every 30s.
const WATCHLIST_TICKS = 6;

interface WatchlistItem {
    symbol: string;
    last: number | null;
    bid: number | null;
    ask: number | null;
    close: number | null;
    high: number | null;
    low: number | null;
    volume: number | null;
    error?: string;
}

const Watchlist = () => {
    const [items, setItems] = useState<WatchlistItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [newSymbol, setNewSymbol] = useState('');
    const [adding, setAdding] = useState(false);
    const [error, setError] = useState('');

    const { token, refreshNow } = useRefresh(WATCHLIST_TICKS);

    const reqId = useRef(0);

    const addToWatchlist = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newSymbol) return;

        setAdding(true);
        try {
            await apiPost(`/watchlist?symbol=${encodeURIComponent(newSymbol)}`);
            setNewSymbol('');
            setError('');
            refreshNow();
        } catch (err) {
            setError(`Could not add ${newSymbol}: ${errorMessage(err)}`);
        } finally {
            setAdding(false);
        }
    };

    const removeFromWatchlist = async (symbol: string) => {
        // Native confirm is the right weight for a destructive action.
        if (!confirm(`Remove ${symbol} from watchlist?`)) return;
        try {
            await apiDelete(`/watchlist/${encodeURIComponent(symbol)}`);
            setError('');
            refreshNow();
        } catch (err) {
            setError(`Could not remove ${symbol}: ${errorMessage(err)}`);
        }
    };

    useEffect(() => {
        const id = ++reqId.current;
        setLoading(true);
        void (async () => {
            try {
                const data = await apiGet<WatchlistItem[]>('/watchlist');
                if (id !== reqId.current) return;
                setItems(data);
                setError('');
            } catch (err) {
                if (id !== reqId.current) return;
                setError(errorMessage(err));
            } finally {
                if (id === reqId.current) setLoading(false);
            }
        })();
    }, [token]);

    return (
        <section className="card watchlist-card">
            <h2>Watchlist</h2>

            <form onSubmit={addToWatchlist} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <input
                    type="text"
                    value={newSymbol}
                    onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
                    placeholder="Add Symbol"
                    style={{
                        padding: '8px 12px',
                        borderRadius: '4px',
                        border: '1px solid rgba(255,255,255,0.2)',
                        background: 'rgba(255,255,255,0.05)',
                        color: 'white',
                        fontSize: '0.9rem',
                        flex: 1
                    }}
                />
                <button
                    type="submit"
                    disabled={adding || !newSymbol}
                    style={{
                        padding: '8px 16px',
                        borderRadius: '4px',
                        border: 'none',
                        background: '#3b82f6',
                        color: 'white',
                        cursor: 'pointer',
                        opacity: adding ? 0.6 : 1
                    }}
                >
                    {adding ? '+' : 'Add'}
                </button>
            </form>

            {error && <div className="error-message">{error}</div>}

            <div className="table-responsive">
                <table className="orders-table">
                    <thead>
                        <tr>
                            <th>Symbol</th>
                            <th>Last</th>
                            <th>Bid / Ask</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.length === 0 ? (
                            <tr>
                                <td colSpan={4} style={{ textAlign: 'center', color: '#888' }}>
                                    {loading ? 'Loading...' : 'Watchlist is empty'}
                                </td>
                            </tr>
                        ) : (
                            items.map((item) => (
                                <tr key={item.symbol}>
                                    <td style={{ fontWeight: '600' }}>{item.symbol}</td>
                                    <td>
                                        {item.error ? (
                                            <span style={{ color: '#ef4444', fontSize: '0.8rem' }}>Error</span>
                                        ) : (
                                            <span style={{ color: '#10b981' }}>{item.last?.toFixed(2) || '-'}</span>
                                        )}
                                    </td>
                                    <td style={{ fontSize: '0.85rem', color: '#aaa' }}>
                                        {item.bid?.toFixed(2) || '-'} / {item.ask?.toFixed(2) || '-'}
                                    </td>
                                    <td>
                                        <button
                                            onClick={() => removeFromWatchlist(item.symbol)}
                                            style={{
                                                background: 'transparent',
                                                border: 'none',
                                                color: '#ef4444',
                                                cursor: 'pointer',
                                                fontSize: '1.2rem',
                                                padding: '0 4px',
                                                lineHeight: 1
                                            }}
                                            title="Remove"
                                        >
                                            ×
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </section>
    );
};

export default Watchlist;
