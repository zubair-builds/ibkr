import { useState, useEffect, useRef } from 'react';

export interface Quote {
    symbol: string;
    last: number | null;
    bid: number | null;
    ask: number | null;
}

export function useLiveQuote(symbol: string) {
    const [quote, setQuote] = useState<Quote | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const wsRef = useRef<WebSocket | null>(null);
    const prevSymbolRef = useRef<string>('');

    useEffect(() => {
        const cleanSymbol = symbol.trim().toUpperCase();
        if (!cleanSymbol) {
            setQuote(null);
            return;
        }

        if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = import.meta.env.MODE === 'development' 
                ? `ws://localhost:8000/ws/marketdata` 
                : `${protocol}//${window.location.host}/ws/marketdata`;
            
            wsRef.current = new WebSocket(wsUrl);

            wsRef.current.onopen = () => {
                setIsConnected(true);
                if (cleanSymbol) {
                    wsRef.current?.send(JSON.stringify({ action: 'subscribe', symbol: cleanSymbol }));
                    prevSymbolRef.current = cleanSymbol;
                }
            };

            wsRef.current.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data && data.symbol === cleanSymbol) {
                        setQuote(data);
                    }
                } catch (e) {
                    console.error("Error parsing websocket message", e);
                }
            };

            wsRef.current.onclose = () => {
                setIsConnected(false);
            };
        } else if (wsRef.current.readyState === WebSocket.OPEN) {
            if (cleanSymbol !== prevSymbolRef.current) {
                if (prevSymbolRef.current) {
                    wsRef.current.send(JSON.stringify({ action: 'unsubscribe', symbol: prevSymbolRef.current }));
                }
                wsRef.current.send(JSON.stringify({ action: 'subscribe', symbol: cleanSymbol }));
                prevSymbolRef.current = cleanSymbol;
                setQuote(null);
            }
        }

        return () => {};
    }, [symbol]);

    useEffect(() => {
        return () => {
            if (wsRef.current) {
                if (prevSymbolRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({ action: 'unsubscribe', symbol: prevSymbolRef.current }));
                }
                wsRef.current.close();
            }
        };
    }, []);

    return { quote, isConnected };
}
