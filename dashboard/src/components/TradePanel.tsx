import { useState } from 'react';

const TradePanel = () => {
    const [symbol, setSymbol] = useState('AAPL');
    const [quantity, setQuantity] = useState(1);
    const [action, setAction] = useState('BUY');
    const [isLoading, setIsLoading] = useState(false);

    const handleTrade = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!confirm(`Are you sure you want to ${action} ${quantity} ${symbol}?`)) return;

        setIsLoading(true);
        try {
            const res = await fetch('http://localhost:8000/trade', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbol: symbol.toUpperCase(), action, quantity })
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.detail || 'Trade failed');

            alert(`Order executed! ID: ${data.order_id}`);
        } catch (e: any) {
            alert(`Trade Error: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <section className="card trade-card" style={{ marginTop: '20px' }}>
            <h2>Manual Trade</h2>
            <form onSubmit={handleTrade} style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ fontSize: '0.8rem', color: '#888' }}>Symbol</label>
                    <input
                        type="text"
                        value={symbol}
                        onChange={(e) => setSymbol(e.target.value)}
                        style={{ padding: '8px', borderRadius: '4px', border: '1px solid #444', background: '#333', color: 'white', width: '80px' }}
                    />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ fontSize: '0.8rem', color: '#888' }}>Action</label>
                    <select
                        value={action}
                        onChange={(e) => setAction(e.target.value)}
                        style={{ padding: '8px', borderRadius: '4px', border: '1px solid #444', background: '#333', color: 'white' }}
                    >
                        <option value="BUY">BUY</option>
                        <option value="SELL">SELL</option>
                    </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ fontSize: '0.8rem', color: '#888' }}>Qty</label>
                    <input
                        type="number"
                        value={quantity}
                        onChange={(e) => setQuantity(Number(e.target.value))}
                        min="1"
                        style={{ padding: '8px', borderRadius: '4px', border: '1px solid #444', background: '#333', color: 'white', width: '60px' }}
                    />
                </div>

                <button
                    type="submit"
                    disabled={isLoading}
                    style={{
                        padding: '8px 16px',
                        borderRadius: '4px',
                        border: 'none',
                        background: action === 'BUY' ? '#10b981' : '#ef4444',
                        color: 'white',
                        fontWeight: 600,
                        cursor: 'pointer',
                        opacity: isLoading ? 0.7 : 1
                    }}
                >
                    {isLoading ? 'Processing...' : `SUBMIT ORDER`}
                </button>
            </form>
        </section>
    );
};

export default TradePanel;
