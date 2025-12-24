import { useState, useEffect } from 'react';

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

    const checkConnection = async () => {
        setIsRefreshing(true);
        try {
            const res = await fetch('http://localhost:8000/health');
            const data = await res.json();
            setConnectionData(data);
        } catch (e) {
            setConnectionData({
                status: 'error',
                operational: false,
                connection: { error: String(e) }
            });
        } finally {
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        checkConnection();
        const interval = setInterval(checkConnection, 30000); // Poll every 30s
        return () => clearInterval(interval);
    }, []);

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
                onClick={checkConnection}
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
                    onClick={async () => {
                        setIsRefreshing(true);
                        try {
                            const res = await fetch('http://localhost:8000/connect', { method: 'POST' });
                            const data = await res.json();
                            if (!res.ok) throw new Error(data.detail || 'Failed to connect');
                            alert('Connected: ' + data.message);
                            checkConnection();
                        } catch (e: any) {
                            alert('Connection failed: ' + e.message);
                        } finally {
                            setIsRefreshing(false);
                        }
                    }}
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

            {/* Expanded details could go here in a tooltip */}
        </div>
    );
};

export default ConnectionStatus;
