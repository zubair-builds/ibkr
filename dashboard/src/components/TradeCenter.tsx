import { useState } from 'react';
import { apiPost, errorMessage } from '../api';
import { useRefresh } from '../refresh';
import LiveQuote from './LiveQuote';

interface Order {
  orderId?: number;
  ticker: string;
  action: string;
  quantity: number;
  status: string;
  orderType?: string;
  lmtPrice?: number;
  filled: number;
  remaining: number;
  avgFillPrice: number;
  lastUpdateTime: string;
}

interface TradeCenterProps {
  orders: Order[];
}

const TradeCenter = ({ orders }: TradeCenterProps) => {
  const [activeTab, setActiveTab] = useState<'new' | 'pending' | 'history'>('new');
  // New Trade State
  const [symbol, setSymbol] = useState('');
  const [action, setAction] = useState<'BUY' | 'SELL'>('BUY');
  const [orderType, setOrderType] = useState<'MKT' | 'LMT'>('LMT');
  const [quantity, setQuantity] = useState(1);
  const [lmtPrice, setLmtPrice] = useState('');
  const [outsideRth, setOutsideRth] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tradeMessage, setTradeMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Edit State
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);
  const [editQty, setEditQty] = useState<number>(0);
  const [editPrice, setEditPrice] = useState<string>('');

  const { refreshNow } = useRefresh();

  // Pending orders typically have these statuses
  const activeStatuses = ['PendingSubmit', 'PreSubmitted', 'Submitted', 'PendingCancel'];
  const pendingOrders = orders.filter(o => activeStatuses.includes(o.status));
  const historyOrders = orders.filter(o => !activeStatuses.includes(o.status));

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setTradeMessage(null);
    if (!symbol) return;
    
    setIsSubmitting(true);
    try {
      const payload = {
        symbol: symbol.toUpperCase(),
        action,
        quantity,
        order_type: orderType,
        ...(orderType === 'LMT' ? { lmt_price: parseFloat(lmtPrice) } : {}),
        outside_rth: orderType === 'LMT' ? outsideRth : false
      };
      await apiPost('/order', payload);
      setTradeMessage({ type: 'success', text: 'Order placed successfully!' });
      refreshNow();
      setSymbol('');
      setLmtPrice('');
    } catch (err) {
      setTradeMessage({ type: 'error', text: errorMessage(err) });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelOrder = async (orderId: number) => {
      try {
          await apiPost(`/order/${orderId}/cancel`, {});
          refreshNow();
      } catch (err) {
          alert(errorMessage(err));
      }
  };

  const handleModifySave = async (orderId: number) => {
      try {
          await apiPost(`/order/${orderId}/modify`, {
              quantity: editQty,
              lmt_price: editPrice ? parseFloat(editPrice) : null
          });
          setEditingOrderId(null);
          refreshNow();
      } catch (err) {
          alert(errorMessage(err));
      }
  };


  return (
      <section className="card trade-center-card">
        <div className="trade-center-header">
            <h2>Trade Center</h2>
            <div className="tabs">
                <button type="button" className={`tab-btn ${activeTab === 'new' ? 'active' : ''}`} onClick={() => setActiveTab('new')}>New Trade</button>
                <button type="button" className={`tab-btn ${activeTab === 'pending' ? 'active' : ''}`} onClick={() => setActiveTab('pending')}>
                    Pending {pendingOrders.length > 0 && <span className="tab-badge">{pendingOrders.length}</span>}
                </button>
                <button type="button" className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>History</button>
            </div>
        </div>

        <div className="tab-content">
            {activeTab === 'new' && (
                <form className="new-trade-form" onSubmit={handlePlaceOrder}>
                    <div className="form-row">
                        <div className="form-group" style={{ flex: 1 }}>
                            <label>Symbol</label>
                            <input type="text" value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())} placeholder="AAPL" required className="modern-input" />
                            <LiveQuote symbol={symbol} />
                        </div>
                        <div className="form-group action-toggle">
                            <label>Action</label>
                            <div className="toggle-group">
                                <button type="button" className={`toggle-btn buy ${action === 'BUY' ? 'active' : ''}`} onClick={() => setAction('BUY')}>BUY</button>
                                <button type="button" className={`toggle-btn sell ${action === 'SELL' ? 'active' : ''}`} onClick={() => setAction('SELL')}>SELL</button>
                            </div>
                        </div>
                    </div>
                    
                    <div className="form-row">
                        <div className="form-group">
                            <label>Order Type</label>
                            <select value={orderType} onChange={e => setOrderType(e.target.value as 'MKT' | 'LMT')} className="modern-select">
                                <option value="LMT">Limit (LMT)</option>
                                <option value="MKT">Market (MKT)</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Quantity</label>
                            <input type="number" min="1" step="1" value={quantity} onChange={e => setQuantity(parseInt(e.target.value) || 1)} required className="modern-input" />
                        </div>
                        {orderType === 'LMT' && (
                            <div className="form-group">
                                <label>Limit Price</label>
                                <input type="number" min="0.01" step="0.01" value={lmtPrice} onChange={e => setLmtPrice(e.target.value)} required placeholder="0.00" className="modern-input" />
                            </div>
                        )}
                    </div>

                    <div className="form-row">
                        <div className="form-group checkbox-group">
                            <label className="checkbox-label" title="Only applies to Limit (LMT) orders">
                                <input 
                                    type="checkbox" 
                                    checked={outsideRth} 
                                    onChange={e => setOutsideRth(e.target.checked)} 
                                    disabled={orderType === 'MKT'} 
                                />
                                Allow Extended Hours (Pre/Post Market)
                            </label>
                        </div>
                    </div>
                    
                    {tradeMessage && (
                        <div className={`trade-message ${tradeMessage.type}`}>
                            {tradeMessage.text}
                        </div>
                    )}

                    <div className="form-actions">
                        <button type="submit" className={`submit-order-btn ${action.toLowerCase()}`} disabled={isSubmitting}>
                            {isSubmitting ? 'Submitting...' : `Place ${action} Order`}
                        </button>
                    </div>
                </form>
            )}

            {activeTab === 'pending' && (
                <div className="table-responsive">
                    {pendingOrders.length === 0 ? (
                        <div className="empty-state">No pending orders</div>
                    ) : (
                        <table className="orders-table">
                            <thead>
                                <tr>
                                    <th>Time</th>
                                    <th>Ticker</th>
                                    <th>Action</th>
                                    <th>Type</th>
                                    <th>Price</th>
                                    <th>Qty</th>
                                    <th>Status</th>
                                    <th>Filled</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[...pendingOrders].reverse().map((order, idx) => (
                                    <tr key={idx}>
                                        <td className="time-col">{order.lastUpdateTime}</td>
                                        <td><strong>{order.ticker}</strong></td>
                                        <td><span className={`badge ${order.action.toLowerCase()}`}>{order.action}</span></td>
                                        <td>{order.orderType || '-'}</td>
                                        {editingOrderId === order.orderId ? (
                                            <>
                                                <td>
                                                    {order.orderType === 'LMT' ? (
                                                        <input type="number" step="0.01" style={{width: '70px', padding: '2px'}} value={editPrice} onChange={e => setEditPrice(e.target.value)} />
                                                    ) : (
                                                        '-'
                                                    )}
                                                </td>
                                                <td>
                                                    <input type="number" step="1" style={{width: '60px', padding: '2px'}} value={editQty} onChange={e => setEditQty(parseInt(e.target.value) || 1)} />
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td>{order.lmtPrice ? `$${order.lmtPrice.toFixed(2)}` : '-'}</td>
                                                <td>{order.quantity}</td>
                                            </>
                                        )}
                                        <td><span className={`status-pill ${order.status.toLowerCase()}`}>{order.status}</span></td>
                                        <td>{order.filled}/{order.quantity}</td>
                                        <td className="actions-col" style={{ display: 'flex', gap: '5px' }}>
                                            {editingOrderId === order.orderId ? (
                                                <>
                                                    <button style={{padding: '2px 5px', fontSize: '11px', backgroundColor: '#3b82f6'}} onClick={() => handleModifySave(order.orderId!)}>Save</button>
                                                    <button style={{padding: '2px 5px', fontSize: '11px', backgroundColor: '#6b7280'}} onClick={() => setEditingOrderId(null)}>X</button>
                                                </>
                                            ) : (
                                                order.orderId && (
                                                    <>
                                                        <button style={{padding: '2px 5px', fontSize: '11px', backgroundColor: '#3b82f6'}} onClick={() => { setEditingOrderId(order.orderId!); setEditQty(order.quantity); setEditPrice(order.lmtPrice ? order.lmtPrice.toString() : ''); }}>Mod</button>
                                                        <button style={{padding: '2px 5px', fontSize: '11px', backgroundColor: '#ef4444'}} onClick={() => handleCancelOrder(order.orderId!)}>Cancel</button>
                                                    </>
                                                )
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {activeTab === 'history' && (
                <div className="table-responsive">
                    {historyOrders.length === 0 ? (
                        <div className="empty-state">No order history</div>
                    ) : (
                        <table className="orders-table">
                            <thead>
                                <tr>
                                    <th>Time</th>
                                    <th>Ticker</th>
                                    <th>Action</th>
                                    <th>Type</th>
                                    <th>Price</th>
                                    <th>Qty</th>
                                    <th>Status</th>
                                    <th>Filled</th>
                                    <th>Avg Price</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[...historyOrders].reverse().map((order, idx) => (
                                    <tr key={idx}>
                                        <td className="time-col">{order.lastUpdateTime}</td>
                                        <td><strong>{order.ticker}</strong></td>
                                        <td><span className={`badge ${order.action.toLowerCase()}`}>{order.action}</span></td>
                                        <td>{order.orderType || '-'}</td>
                                        <td>{order.lmtPrice ? `$${order.lmtPrice.toFixed(2)}` : '-'}</td>
                                        <td>{order.quantity}</td>
                                        <td><span className={`status-pill ${order.status.toLowerCase()}`}>{order.status}</span></td>
                                        <td>{order.filled}/{order.quantity}</td>
                                        <td>{order.avgFillPrice ? `$${order.avgFillPrice.toFixed(2)}` : '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
        </div>
      </section>
  );
};

export default TradeCenter;
