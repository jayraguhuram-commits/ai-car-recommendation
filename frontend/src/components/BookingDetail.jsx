import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import BASE from '../api';
import './BookingDetail.css';

export default function BookingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      navigate('/login');
      return;
    }
    fetchDetail(token);
  }, [id]);

  const fetchDetail = async (token) => {
    try {
      const res = await fetch(`${BASE}/api/enquiries/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const resData = await res.json();
      if (resData.success) {
        setData(resData.data);
      } else {
        toast.error(resData.message || 'Failed to load booking');
      }
    } catch (err) {
      toast.error('Network error.');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (status) => {
    const token = localStorage.getItem('adminToken');
    try {
      const res = await fetch(`${BASE}/api/enquiries/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      const resData = await res.json();
      if (resData.success) {
        toast.success(`Booking marked as ${status}`);
        fetchDetail(token); // refresh
      } else {
        toast.error(resData.message);
      }
    } catch (err) {
      toast.error('Failed to update status.');
    }
  };

  const handleEraseEnquiry = async () => {
    const confirmed = await window.__showConfirmModal({
      title: 'Cancel & Erase Booking?',
      message: 'This will permanently delete the booking from the system and send a notification to the customer. This action cannot be undone.',
      danger: true,
      confirmLabel: '🗑️ Yes, Cancel & Erase',
      cancelLabel: 'Keep Booking',
    });
    if (!confirmed) return;
    const token = localStorage.getItem('adminToken');
    try {
      const res = await fetch(`${BASE}/api/enquiries/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const resData = await res.json();
      if (resData.success) {
        toast.success('✅ Booking cancelled and erased successfully!', { duration: 4000 });
        if (resData.notification) {
          toast(`🔔 Passenger Notified!\nTo: ${resData.notification.to}\nMsg: "${resData.notification.message.substring(0, 60)}..."`, {
            icon: '📩',
            duration: 6000,
          });
        }
        navigate('/dashboard');
      } else {
        toast.error(resData.message || 'Failed to erase booking.');
      }
    } catch (err) {
      toast.error('Connection error.');
    }
  };

  if (loading) return <div className="container py-4">Loading booking details...</div>;
  if (!data) return <div className="container py-4">Booking not found.</div>;

  return (
    <div className="booking-detail-page">
      <div className="container">
        <Link to="/dashboard" className="back-link">← Back to Dashboard</Link>

        <div className="detail-header-card card">
          <div className="detail-header-left">
            <h1 className="detail-id">Booking #{data.enquiry_id}</h1>
            <div className="detail-status">
              Status: <span className={`badge badge-${data.status === 'confirmed' ? 'success' : data.status === 'cancelled' ? 'error' : 'warning'}`}>
                {data.status.toUpperCase()}
              </span>
            </div>
          </div>
          <div className="detail-actions">
            {data.status !== 'confirmed' && (
              <button className="btn-primary" onClick={() => updateStatus('confirmed')}>
                Confirm Booking
              </button>
            )}
            <button className="btn-secondary" style={{ color: 'var(--color-error-text)', borderColor: 'var(--color-error-text)' }} onClick={handleEraseEnquiry}>
              🗑️ Cancel & Erase Request
            </button>
          </div>
        </div>

        <div className="grid-2 detail-grid">
          {/* Customer & Trip Details */}
          <div className="card">
            <h2 className="section-heading">Customer & Trip Details</h2>
            <div className="detail-list">
              <div className="detail-item"><span>Customer:</span> {data.customer_name}</div>
              <div className="detail-item"><span>Phone:</span> {data.phone}</div>
              <div className="detail-item"><span>Email:</span> {data.email || '-'}</div>
              <div className="divider"></div>
              <div className="detail-item"><span>Trip Type:</span> {data.trip_type}</div>
              <div className="detail-item"><span>Passengers:</span> {data.passengers}</div>
              <div className="detail-item"><span>Luggage:</span> {data.luggage}</div>
              <div className="detail-item"><span>Pickup:</span> {data.pickup_location}</div>
              <div className="detail-item"><span>Drop:</span> {data.drop_location || '-'}</div>
              <div className="detail-item"><span>Trip Date:</span> {new Date(data.trip_date).toLocaleDateString()}</div>
              {data.return_date && <div className="detail-item"><span>Return Date:</span> {new Date(data.return_date).toLocaleDateString()}</div>}
              {data.special_requirements && (
                <div className="detail-item flex-col">
                  <span>Special Requirements:</span>
                  <p>{data.special_requirements}</p>
                </div>
              )}
            </div>
          </div>

          <div className="detail-right-col">
            {/* Assigned Car */}
            <div className="card">
              <h2 className="section-heading">Assigned Car</h2>
              {data.recommended_vehicle_id ? (
                <div className="assigned-car-info">
                  <div className="assigned-icon">🚗</div>
                  <div>
                    <div className="assigned-name">{data.vehicle_name}</div>
                    <div className="assigned-specs">{data.vehicle_seats} Seats • {data.vehicle_category}</div>
                    <div className="assigned-price">₹{data.vehicle_price}/day</div>
                  </div>
                </div>
              ) : data.ai_recommendation ? (
                <div className="assigned-car-info">
                  <div className="assigned-icon">🚗</div>
                  <div>
                    <div className="assigned-name">{data.ai_recommendation.vehicle_name}</div>
                    <div className="assigned-specs">
                      {data.ai_recommendation.seats ? `${data.ai_recommendation.seats} Seats` : ''} 
                      {data.ai_recommendation.category ? ` • ${data.ai_recommendation.category}` : ''}
                    </div>
                    <div className="assigned-price">₹{data.ai_recommendation.price_per_day || data.ai_recommendation.price}/day</div>
                  </div>
                </div>
              ) : (
                <p className="text-muted">No car assigned.</p>
              )}
            </div>

            {/* AI Recommendation Reason */}
            {(data.ai_recommendation?.reason || data.ai_recommendation?.recommendations?.[0]?.reason) && (
              <div className="card ai-reason-card">
                <h2 className="section-heading">🤖 AI Match Reason</h2>
                <p>{data.ai_recommendation.reason || data.ai_recommendation.recommendations[0].reason}</p>
              </div>
            )}

            {/* Action History */}
            <div className="card history-card">
              <h2 className="section-heading">📋 Action History</h2>
              <div className="history-timeline">
                {data.history.map(item => (
                  <div key={item.history_id} className="history-item">
                    <div className="history-dot"></div>
                    <div className="history-content">
                      <div className="history-action">{item.action}</div>
                      <div className="history-meta">
                        {new Date(item.timestamp).toLocaleString()} • by {item.performed_by}
                      </div>
                      {item.notes && <div className="history-notes">{item.notes}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
