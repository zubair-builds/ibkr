import { useState, useEffect, useRef } from 'react';
import './App.css';

import { apiGet, errorMessage } from './api';
import { useRefresh } from './refresh';

interface Order {
  ticker: string;
  action: string;
  quantity: number;
  status: string;
  filled: number;
  remaining: number;
  avgFillPrice: number;
  lastUpdateTime: string;
}

/** /account returns a flat map of IB tag -> value, both strings. */
type AccountSummary = Record<string, string>;

import ConnectionStatus from './components/ConnectionStatus';
import HistoricalChart from './components/HistoricalChart';
import PortfolioTable from './components/PortfolioTable';
import Watchlist from './components/Watchlist';

function App() {
  const [account, setAccount] = useState<AccountSummary>({});
  const [orders, setOrders] = useState<Order[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [error, setError] = useState('');

  const { token, refreshNow } = useRefresh();

  // Requests can outlive the tick that started them (/account and /orders are
  // serial, and a slow bot can push a response past the next 5s tick), so stamp
  // each run and drop any result that a newer run has superseded.
  const reqId = useRef(0);

  useEffect(() => {
    const id = ++reqId.current;
    void (async () => {
      try {
        const status = await apiGet<{ operational: boolean }>('/health');
        if (id !== reqId.current) return;

        if (status.operational) {
          const [nextAccount, nextOrders] = [
            await apiGet<AccountSummary>('/account'),
            await apiGet<Order[]>('/orders'),
          ];
          if (id !== reqId.current) return;
          setAccount(nextAccount);
          setOrders(nextOrders);
        }
        setError('');
        setLastUpdated(new Date());
      } catch (e) {
        if (id !== reqId.current) return;
        setError(errorMessage(e));
      }
    })();
  }, [token]);

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>IBKR Bot Dashboard</h1>
        <div className="header-actions">
          <button className="btn-refresh" onClick={refreshNow} title="Refresh account and orders">
            Refresh
          </button>
          <ConnectionStatus />
        </div>
      </header>

      {error && <div className="error-message">{error}</div>}

      <main className="dashboard-grid">
        {/* Account Summary Card */}
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

        <section className="portfolio-section">
          <PortfolioTable />
        </section>

        {/* Historical Data Chart */}
        <HistoricalChart />
        
        {/* Watchlist */}
        <Watchlist />
      </main>

      <footer className="dashboard-footer">
        Last updated: {lastUpdated.toLocaleTimeString()}
      </footer>
    </div>
  );
}

export default App;
