import { useState } from 'react';
import { apiGet, errorMessage } from '../api';
import PriceChart from './PriceChart';
import type { Bar as HistoricalBar } from './PriceChart';

interface Quote {
    symbol: string;
    last: number | null;
    bid: number | null;
    ask: number | null;
    close: number | null;
    high: number | null;
    low: number | null;
    volume: number | null;
    time: string | null;
}

const HistoricalChart = () => {
    const [activeTab, setActiveTab] = useState<'historical' | 'quote'>('historical');
    const [symbol, setSymbol] = useState('AAPL');
    const [duration, setDuration] = useState('1 M');
    const [barSize, setBarSize] = useState('1 day');
    const [historicalData, setHistoricalData] = useState<HistoricalBar[]>([]);
    const [quote, setQuote] = useState<Quote | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const fetchHistoricalData = async () => {
        setLoading(true);
        setError('');
        try {
            // api.ts unwraps FastAPI's detail, including /historical's
            // {error, ib_error_code} object on the 502 path.
            const data = await apiGet<{ bars: HistoricalBar[] }>(
                `/historical?symbol=${encodeURIComponent(symbol)}` +
                `&duration=${encodeURIComponent(duration)}` +
                `&bar_size=${encodeURIComponent(barSize)}`
            );
            const bars = data.bars ?? [];
            setHistoricalData(bars);
            if (bars.length === 0) {
                setError('No historical data available. HMDS connection may be inactive.');
            }
        } catch (e) {
            setError(errorMessage(e));
        } finally {
            setLoading(false);
        }
    };

    const fetchQuote = async () => {
        setLoading(true);
        setError('');
        try {
            setQuote(await apiGet<Quote>(`/quote?symbol=${encodeURIComponent(symbol)}`));
        } catch (e) {
            setError(errorMessage(e));
            setQuote(null);
        } finally {
            setLoading(false);
        }
    };

    const handleFetch = () => {
        if (activeTab === 'historical') {
            fetchHistoricalData();
        } else {
            fetchQuote();
        }
    };

    return (
        <section className="card" style={{ gridColumn: '1 / -1' }}>
            <h2>Market Data</h2>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <button
                    onClick={() => setActiveTab('historical')}
                    style={{
                        padding: '8px 16px',
                        border: 'none',
                        background: activeTab === 'historical' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                        color: activeTab === 'historical' ? '#3b82f6' : 'rgba(255,255,255,0.6)',
                        borderBottom: activeTab === 'historical' ? '2px solid #3b82f6' : '2px solid transparent',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        fontWeight: activeTab === 'historical' ? 600 : 400,
                    }}
                >
                    Historical Data
                </button>
                <button
                    onClick={() => setActiveTab('quote')}
                    style={{
                        padding: '8px 16px',
                        border: 'none',
                        background: activeTab === 'quote' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                        color: activeTab === 'quote' ? '#3b82f6' : 'rgba(255,255,255,0.6)',
                        borderBottom: activeTab === 'quote' ? '2px solid #3b82f6' : '2px solid transparent',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        fontWeight: activeTab === 'quote' ? 600 : 400,
                    }}
                >
                    Current Quote
                </button>
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <input
                    type="text"
                    list="ticker-options"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                    placeholder="Symbol"
                    style={{
                        padding: '8px 12px',
                        borderRadius: '4px',
                        border: '1px solid rgba(255,255,255,0.2)',
                        background: 'rgba(255,255,255,0.05)',
                        color: 'white',
                        fontSize: '0.9rem',
                        width: '120px'
                    }}
                />
                <datalist id="ticker-options">
                    <option value="AAPL">Apple Inc.</option>
                    <option value="TSLA">Tesla, Inc.</option>
                    <option value="MSFT">Microsoft Corp.</option>
                    <option value="NVDA">NVIDIA Corp.</option>
                    <option value="GOOGL">Alphabet Inc.</option>
                    <option value="AMZN">Amazon.com, Inc.</option>
                    <option value="META">Meta Platforms, Inc.</option>
                    <option value="SPY">SPDR S&P 500 ETF</option>
                    <option value="QQQ">Invesco QQQ Trust</option>
                    <option value="F">Ford Motor Company</option>
                </datalist>

                {activeTab === 'historical' && (
                    <>
                        <select
                            value={duration}
                            onChange={(e) => setDuration(e.target.value)}
                            style={{
                                padding: '8px 12px',
                                borderRadius: '4px',
                                border: '1px solid rgba(255,255,255,0.2)',
                                background: 'rgba(255,255,255,0.05)',
                                color: 'white',
                                fontSize: '0.9rem'
                            }}
                        >
                            <option value="1 D">1 Day</option>
                            <option value="5 D">5 Days</option>
                            <option value="1 M">1 Month</option>
                            <option value="3 M">3 Months</option>
                            <option value="1 Y">1 Year</option>
                        </select>

                        <select
                            value={barSize}
                            onChange={(e) => setBarSize(e.target.value)}
                            style={{
                                padding: '8px 12px',
                                borderRadius: '4px',
                                border: '1px solid rgba(255,255,255,0.2)',
                                background: 'rgba(255,255,255,0.05)',
                                color: 'white',
                                fontSize: '0.9rem'
                            }}
                        >
                            <option value="1 min">1 Minute</option>
                            <option value="5 mins">5 Minutes</option>
                            <option value="1 hour">1 Hour</option>
                            <option value="1 day">1 Day</option>
                        </select>
                    </>
                )}

                <button
                    onClick={handleFetch}
                    disabled={loading}
                    style={{
                        padding: '8px 16px',
                        borderRadius: '4px',
                        border: 'none',
                        background: '#3b82f6',
                        color: 'white',
                        fontSize: '0.9rem',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        opacity: loading ? 0.6 : 1
                    }}
                >
                    {loading ? 'Loading...' : 'Fetch Data'}
                </button>
            </div>

            {error && (
                <div style={{
                    padding: '12px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '4px',
                    color: '#fca5a5',
                    fontSize: '0.9rem',
                    marginBottom: '16px'
                }}>
                    {error}
                </div>
            )}

            {/* Historical Data View */}
            {activeTab === 'historical' && historicalData.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                    <PriceChart bars={historicalData} />
                </div>
            )}

            {activeTab === 'historical' && historicalData.length > 0 && (
                <div className="table-responsive">
                    <table className="orders-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Open</th>
                                <th>High</th>
                                <th>Low</th>
                                <th>Close</th>
                                <th>Volume</th>
                            </tr>
                        </thead>
                        <tbody>
                            {historicalData.map((bar, idx) => (
                                <tr key={idx}>
                                    <td>{new Date(bar.date).toLocaleDateString()}</td>
                                    <td>{bar.open?.toFixed(2) || '-'}</td>
                                    <td>{bar.high?.toFixed(2) || '-'}</td>
                                    <td>{bar.low?.toFixed(2) || '-'}</td>
                                    <td>{bar.close?.toFixed(2) || '-'}</td>
                                    <td>{bar.volume?.toLocaleString() || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Quote View */}
            {activeTab === 'quote' && quote && (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '16px',
                    padding: '16px',
                    background: 'rgba(255,255,255,0.02)',
                    borderRadius: '8px'
                }}>
                    <div>
                        <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>Symbol</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>{quote.symbol}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>Last Price</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 600, color: '#10b981' }}>
                            {quote.last ? `$${quote.last.toFixed(2)}` : '-'}
                        </div>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>Bid / Ask</div>
                        <div style={{ fontSize: '1rem' }}>
                            {quote.bid?.toFixed(2) || '-'} / {quote.ask?.toFixed(2) || '-'}
                        </div>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>Close</div>
                        <div style={{ fontSize: '1rem' }}>{quote.close?.toFixed(2) || '-'}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>High / Low</div>
                        <div style={{ fontSize: '1rem' }}>
                            {quote.high?.toFixed(2) || '-'} / {quote.low?.toFixed(2) || '-'}
                        </div>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>Volume</div>
                        <div style={{ fontSize: '1rem' }}>{quote.volume?.toLocaleString() || '-'}</div>
                    </div>
                    {quote.time && (
                        <div>
                            <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>Time</div>
                            <div style={{ fontSize: '0.9rem' }}>{new Date(quote.time).toLocaleString()}</div>
                        </div>
                    )}
                </div>
            )}

            {/* Empty State */}
            {!loading && !error && (
                (activeTab === 'historical' && historicalData.length === 0) ||
                (activeTab === 'quote' && !quote)
            ) && (
                    <div className="empty-state">
                        Enter a symbol and click "Fetch Data" to view {activeTab === 'historical' ? 'historical prices' : 'current market data'}
                    </div>
                )}
        </section>
    );
};

export default HistoricalChart;
