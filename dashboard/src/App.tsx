import { useState, useEffect } from 'react';
import './App.css';

import ConnectionStatus from './components/ConnectionStatus';
import TradePanel from './components/TradePanel';

const API_BASE = 'http://localhost:8000';

function App() {
  const [account, setAccount] = useState<any>({});
  const [orders, setOrders] = useState<any[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchData = async () => {
    try {
      const statusRes = await fetch(`${API_BASE}/health`);
      const statusData = await statusRes.json();

      if (statusData.operational) {
        const accountRes = await fetch(`${API_BASE}/account`);
        setAccount(await accountRes.json());

        const ordersRes = await fetch(`${API_BASE}/orders`);
        setOrders(await ordersRes.json());
      }
      setLastUpdated(new Date());
    } catch (e) {
      console.error("Failed to fetch data", e);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 2000); // Poll every 2s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>IBKR Bot Dashboard</h1>
        <ConnectionStatus />
      </header>

      <main className="dashboard-grid">
        {/* Account Summary Card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <section className="card account-card">
            <h2>Account Summary</h2>
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-label">Net Liquidation</span>
                <span className="stat-value highlight">
                  {account.NetLiquidation ? `$${Number(account.NetLiquidation).toLocaleString()}` : '--'}
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Total Cash</span>
                <span className="stat-value">
                  {account.TotalCashValue ? `$${Number(account.TotalCashValue).toLocaleString()}` : '--'}
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Buying Power</span>
                <span className="stat-value">
                  {account.BuyingPower ? `$${Number(account.BuyingPower).toLocaleString()}` : '--'}
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Unrealized P&L</span>
                <span className={`stat-value ${Number(account.UnrealizedPnL) >= 0 ? 'positive' : 'negative'}`}>
                  {account.UnrealizedPnL ? `$${Number(account.UnrealizedPnL).toLocaleString()}` : '--'}
                </span>
              </div>
            </div>
          </section>

          <TradePanel />
        </div>

        {/* Active Orders Table */}
        <section className="card orders-card">
          <h2>Active Orders & Trades</h2>
          {orders.length === 0 ? (
            <div className="empty-state">No active orders</div>
          ) : (
            <div className="table-responsive">
              <table className="orders-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Ticker</th>
                    <th>Action</th>
                    <th>Qty</th>
                    <th>Status</th>
                    <th>Filled</th>
                    <th>Price</th>
                  </tr>
                </thead>
                <tbody>
                  {[...orders].reverse().map((order, idx) => (
                    <tr key={idx}>
                      <td style={{ fontSize: '0.85rem', color: '#888' }}>{order.lastUpdateTime}</td>
                      <td>{order.ticker}</td>
                      <td>
                        <span className={`badge ${order.action.toLowerCase()}`}>{order.action}</span>
                      </td>
                      <td>{order.quantity}</td>
                      <td>
                        <span className={`status-pill ${order.status.toLowerCase()}`}>{order.status}</span>
                      </td>
                      <td>{order.filled}/{order.quantity}</td>
                      <td>{order.avgFillPrice ? `$${order.avgFillPrice}` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      <footer className="dashboard-footer">
        Last updated: {lastUpdated.toLocaleTimeString()}
      </footer>
    </div>
  );
}

export default App;
