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
import type { ConnectionState } from './components/ConnectionStatus';
import TradeCenter from './components/TradeCenter';
import HistoricalChart from './components/HistoricalChart';
import PortfolioTable from './components/PortfolioTable';
import Watchlist from './components/Watchlist';
import AutopilotPanel from './components/AutopilotPanel';

function App() {
  const [account, setAccount] = useState<AccountSummary>({});
  const [orders, setOrders] = useState<Order[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [error, setError] = useState('');
  const [connectionData, setConnectionData] = useState<ConnectionState>({
    status: 'loading',
    operational: false
  });

  const { token, refreshNow, intervalMs, setIntervalMs } = useRefresh();

  // Requests can outlive the tick that started them (/account and /orders are
  // serial, and a slow bot can push a response past the next 5s tick), so stamp
  // each run and drop any result that a newer run has superseded.
  const reqId = useRef(0);

  useEffect(() => {
    const id = ++reqId.current;
    void (async () => {
      try {
        const status = await apiGet<ConnectionState>('/health');
        if (id !== reqId.current) return;
        
        setConnectionData(status);

        if (status.operational) {
          const [nextAccount, nextOrders, nextExecutions] = await Promise.all([
            apiGet<AccountSummary>('/account'),
            apiGet<Order[]>('/orders'),
            apiGet<Order[]>('/executions').catch(() => [] as Order[])
          ]);
          if (id !== reqId.current) return;
          
          setAccount(nextAccount);
          
          // Merge orders and executions. Deduplicate rudimentary by ticker+action+qty
          const allOrders = [...nextOrders];
          const orderKeys = new Set(nextOrders.filter(o => o.status === 'Filled').map(o => `${o.ticker}-${o.action}-${o.quantity}`));
          
          for (const exec of nextExecutions) {
             const key = `${exec.ticker}-${exec.action}-${exec.quantity}`;
             if (!orderKeys.has(key)) {
                 allOrders.push(exec);
             }
          }
          
          // Sort by time
          allOrders.sort((a, b) => a.lastUpdateTime.localeCompare(b.lastUpdateTime));
          
          setOrders(allOrders);
        }
        setError('');
        setLastUpdated(new Date());
      } catch (e) {
        if (id !== reqId.current) return;
        setError(errorMessage(e));
        setConnectionData({
            status: 'error',
            operational: false,
            connection: { error: errorMessage(e) }
        });
      }
    })();
  }, [token]);

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>IBKR Bot Dashboard</h1>
        <div className="header-actions">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>Auto-Refresh:</label>
            <select 
              value={intervalMs === null ? 'off' : intervalMs.toString()}
              onChange={(e) => setIntervalMs(e.target.value === 'off' ? null : parseInt(e.target.value, 10))}
              style={{
                padding: '4px 8px',
                borderRadius: '4px',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                color: 'white',
                fontSize: '0.85rem',
                marginRight: '8px'
              }}
            >
              <option value="off">Off</option>
              <option value="1000">1s</option>
              <option value="2000">2s</option>
              <option value="5000">5s</option>
              <option value="10000">10s</option>
              <option value="30000">30s</option>
              <option value="60000">1m</option>
            </select>
          </div>
          <button className="btn-refresh" onClick={refreshNow} title="Refresh account and orders">
            Refresh
          </button>
          <ConnectionStatus connectionData={connectionData} />
        </div>
      </header>

      {error && <div className="error-message">{error}</div>}

      <main className="dashboard-grid">
        <AutopilotPanel />
        
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

        {/* Trade Center: New Trade, Pending Orders, Order History */}
        <TradeCenter orders={orders} />

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
