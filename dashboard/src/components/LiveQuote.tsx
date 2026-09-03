import React from 'react';
import { useLiveQuote } from '../useLiveQuote';

interface LiveQuoteProps {
    symbol: string;
}

const LiveQuote: React.FC<LiveQuoteProps> = ({ symbol }) => {
    const { quote, isConnected } = useLiveQuote(symbol);

    if (!symbol.trim()) {
        return null;
    }

    return (
        <div className="live-quote-container" style={{
            marginTop: '8px',
            padding: '12px',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.9rem',
            animation: 'fadeIn 0.3s ease-in-out'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: isConnected ? (quote ? '#10b981' : '#f59e0b') : '#ef4444',
                    boxShadow: isConnected && quote ? '0 0 8px #10b981' : 'none'
                }} title={isConnected ? (quote ? 'Connected & Streaming' : 'Connected, waiting for data...') : 'Disconnected'} />
                <span style={{ fontWeight: 600, letterSpacing: '0.5px' }}>{symbol.toUpperCase()}</span>
            </div>

            {quote ? (
                <div style={{ display: 'flex', gap: '16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>Bid</span>
                        <span style={{ fontWeight: 500 }}>{quote.bid ? `$${quote.bid.toFixed(2)}` : '--'}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>Ask</span>
                        <span style={{ fontWeight: 500 }}>{quote.ask ? `$${quote.ask.toFixed(2)}` : '--'}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>Last</span>
                        <span style={{ fontWeight: 600, color: '#3b82f6' }}>{quote.last ? `$${quote.last.toFixed(2)}` : '--'}</span>
                    </div>
                </div>
            ) : (
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>
                    {isConnected ? 'Waiting for quote...' : 'Connecting to live stream...'}
                </div>
            )}
        </div>
    );
};

export default LiveQuote;
