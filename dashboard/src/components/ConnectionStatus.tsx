import { useState, useEffect, useRef } from 'react';
import { apiGet, apiPost, errorMessage } from '../api';
import { useRefresh } from '../refresh';

interface ConnectionState {
    status: 'connected' | 'disconnected' | 'connected_no_accounts' | 'error' | 'loading';
    operational: boolean;
    connection?: {
        host?: string;
        port?: number;
        client_id?: number;
        server_version?: number;
        error?: string;
    };
    accounts?: string[];
}

const ConnectionStatus = () => {
    const [connectionData, setConnectionData] = useState<ConnectionState>({
        status: 'loading',
        operational: false
    });
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [actionMessage, setActionMessage] = useState('');

    const { token, refreshNow } = useRefresh();

    const reqId = useRef(0);

    const reconnect = async () => {
        setIsRefreshing(true);
        try {
            const data = await apiPost<{ message?: string }>('/connect');
            setActionMessage(data.message ?? 'Reconnection requested');
        } catch (e) {
            setActionMessage(`Connection failed: ${errorMessage(e)}`);
        } finally {
            setIsRefreshing(false);
            refreshNow();
        }
    };

    useEffect(() => {
        const id = ++reqId.current;
        setIsRefreshing(true);
        void (async () => {
            try {
                const data = await apiGet<ConnectionState>('/health');
                if (id !== reqId.current) return;
                setConnectionData(data);
            } catch (e) {
                if (id !== reqId.current) return;
                setConnectionData({
                    status: 'error',
                    operational: false,
                    connection: { error: errorMessage(e) }
                });
            } finally {
                if (id === reqId.current) setIsRefreshing(false);
            }
        })();
    }, [token]);

    const getStatusText = () => {
        if (connectionData.status === 'loading') return 'Checking...';
        if (connectionData.operational) return 'Operational';
        if (connectionData.status === 'connected_no_accounts') return 'Connected (No Data)';
        return 'Disconnected';
    };

    return (
        <div className="connection-status" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '8px 12px',
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '8px',
            fontSize: '0.9rem'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: connectionData.operational ? '#4ade80' :
                        connectionData.status === 'connected_no_accounts' ? '#facc15' : '#ef4444',
                    boxShadow: connectionData.operational ? '0 0 8px #4ade80' : 'none',
                    display: 'inline-block'
                }}></span>
                <span style={{ fontWeight: 500 }}>{getStatusText()}</span>
            </div>

            {connectionData.connection?.server_version && (
                <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                    v{connectionData.connection.server_version}
                </span>
            )}

            <button
                onClick={refreshNow}
                disabled={isRefreshing}
                style={{
                    border: 'none',
                    background: 'transparent',
                    color: '#3b82f6',
                    cursor: 'pointer',
                    padding: '4px',
                    fontSize: '0.8rem',
                    opacity: isRefreshing ? 0.5 : 1
                }}
            >
                {isRefreshing ? '...' : 'Verify'}
            </button>

            {!connectionData.operational && connectionData.status !== 'loading' && (
                <button
                    onClick={reconnect}
                    disabled={isRefreshing}
                    style={{
                        marginLeft: '8px',
                        background: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '4px 8px',
                        cursor: 'pointer',
                        fontSize: '0.8rem'
                    }}
                >
                    Reconnect
                </button>
            )}

            {actionMessage && (
                <span style={{ fontSize: '0.8rem', opacity: 0.8 }} title={actionMessage}>
                    {actionMessage}
                </span>
            )}
        </div>
    );
};

export default ConnectionStatus;
