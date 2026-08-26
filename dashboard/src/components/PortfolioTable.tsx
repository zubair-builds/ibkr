import { useState, useEffect, useRef } from 'react';
import { apiGet, errorMessage } from '../api';
import { useRefresh } from '../refresh';

interface Position {
    ticker: string;
    position: number;
    avgCost: number;
    marketPrice: number;
    marketValue: number;
    unrealizedPNL: number;
    realizedPNL: number;
    account: string;
}

const formatCurrency = (val: number | null | undefined): string => {
    if (val == null) return '--';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(val);
};

const formatPnL = (val: number | null | undefined): string => {
    if (val == null) return '--';
    const formatted = Math.abs(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const sign = val >= 0 ? '+' : '-';
    return `${sign}$${formatted}`;
};

const calcPnLPercent = (pos: Position): number | null => {
    const costBasis = (pos.avgCost ?? 0) * Math.abs(pos.position ?? 0);
    if (!costBasis || pos.unrealizedPNL == null) return null;
    return (pos.unrealizedPNL / costBasis) * 100;
};

const formatPnLPercent = (pos: Position): string => {
    const pct = calcPnLPercent(pos);
    if (pct == null) return '--';
    const sign = pct >= 0 ? '+' : '-';
    return `${sign}${Math.abs(pct).toFixed(2)}%`;
};

const PortfolioTable = () => {
    const [positions, setPositions] = useState<Position[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [filter, setFilter] = useState('');

    const filteredPositions = positions.filter(
        (p) => !filter || p.ticker.toLowerCase().includes(filter.trim().toLowerCase())
    );

    const { token, refreshNow } = useRefresh();

    // Drop responses that a newer tick has already superseded.
    const reqId = useRef(0);

    useEffect(() => {
        const id = ++reqId.current;
        setLoading(true);
        void (async () => {
            try {
                const data = await apiGet<Position[]>('/positions');
                if (id !== reqId.current) return;
                setPositions(data);
                setError('');
            } catch (err) {
                if (id !== reqId.current) return;
                setError(errorMessage(err));
            } finally {
                if (id === reqId.current) setLoading(false);
            }
        })();
    }, [token]);

    if (error) {
        return <div className="error-message">Error loading portfolio: {error}</div>;
    }

    return (
        <section className="card portfolio-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                <h2 style={{ margin: 0 }}>Portfolio</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input
                        type="text"
                        placeholder="Filter by symbol..."
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className="portfolio-filter-input"
                    />
                    <button
                        className="refresh-btn"
                        onClick={refreshNow}
                        disabled={loading}
                        title="Refresh positions"
                    >
                        ↻
                    </button>
                </div>
            </div>

            <div className="portfolio-table-wrapper">
                <table className="orders-table portfolio-table">
                    <thead>
                        <tr>
                            <th className="col-index">#</th>
                            <th className="col-symbol">Symbol</th>
                            <th className="col-num">Pos</th>
                            <th className="col-num">Avg Cost</th>
                            <th className="col-num">Mkt Price</th>
                            <th className="col-num">Mkt Value</th>
                            <th className="col-num">Unrl. P&L</th>
                            <th className="col-num">P&L %</th>
                        </tr>
                    </thead>
                    <tbody>
                        {positions.length === 0 ? (
                            <tr>
                                <td colSpan={8} style={{ textAlign: 'center', color: '#888' }}>
                                    {loading ? 'Loading...' : 'No positions found'}
                                </td>
                            </tr>
                        ) : filteredPositions.length === 0 ? (
                            <tr>
                                <td colSpan={8} style={{ textAlign: 'center', color: '#888' }}>
                                    No matching symbols for &quot;{filter}&quot;
                                </td>
                            </tr>
                        ) : (
                            <>
                                {filteredPositions.map((pos, idx) => (
                                    <tr key={pos.ticker} className={idx % 2 === 1 ? 'row-alt' : ''}>
                                        <td className="col-index">{idx + 1}</td>
                                        <td className="col-symbol">{pos.ticker}</td>
                                        <td className="col-num">{pos.position.toLocaleString()}</td>
                                        <td className="col-num">{formatCurrency(pos.avgCost)}</td>
                                        <td className="col-num">{formatCurrency(pos.marketPrice)}</td>
                                        <td className="col-num">{formatCurrency(pos.marketValue)}</td>
                                        <td className={`col-num ${(pos.unrealizedPNL ?? 0) >= 0 ? 'positive' : 'negative'}`}>
                                            {formatPnL(pos.unrealizedPNL)}
                                        </td>
                                        <td className={`col-num ${(calcPnLPercent(pos) ?? 0) >= 0 ? 'positive' : 'negative'}`}>
                                            {formatPnLPercent(pos)}
                                        </td>
                                    </tr>
                                ))}
                                {filteredPositions.length > 0 && (
                                    <tr className="portfolio-totals-row">
                                        <td colSpan={5} className="col-total-label">Total</td>
                                        <td className="col-num">
                                            {formatCurrency(filteredPositions.reduce((s, p) => s + (p.marketValue ?? 0), 0))}
                                        </td>
                                        <td className={`col-num ${(filteredPositions.reduce((s, p) => s + (p.unrealizedPNL ?? 0), 0)) >= 0 ? 'positive' : 'negative'}`}>
                                            {formatPnL(filteredPositions.reduce((s, p) => s + (p.unrealizedPNL ?? 0), 0))}
                                        </td>
                                        <td></td>
                                    </tr>
                                )}
                            </>
                        )}
                    </tbody>
                </table>
            </div>
        </section>
    );
};

export default PortfolioTable;
