import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import BASE from '../api';
import './PassengerHistory.css';

export default function PassengerHistory() {
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);
  
  const user = JSON.parse(localStorage.getItem('passengerUser') || '{}');
  const token = localStorage.getItem('passengerToken');

  useEffect(() => {
    if (!token) {
      toast.error('Please log in as a passenger/customer first.');
      navigate('/login');
      return;
    }
    fetchHistory();
  }, [token]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/enquiries/my-history`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success) {
        setHistory(data.data);
      } else {
        toast.error(data.message || 'Failed to fetch history.');
      }
    } catch (err) {
      toast.error('Network error. Failed to load history.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEnquiry = async (id) => {
    const confirmed = await window.__showConfirmModal({
      title: 'Cancel Your Booking?',
      message: 'This will permanently erase your booking request. You will receive a confirmation notification. This cannot be undone.',
      danger: true,
      confirmLabel: '🗑️ Yes, Cancel Booking',
      cancelLabel: 'Keep It',
    });
    if (!confirmed) return;

    try {
      const res = await fetch(`${BASE}/api/enquiries/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success) {
        toast.success('✅ Booking cancelled and erased!');
        // Show simulated notification banner
        if (data.notification) {
          setNotification(data.notification);
          // Also fire a secondary toast for visibility
          toast(`📩 Notification sent to ${data.notification.to}`, {
            icon: '🔔',
            duration: 6000,
          });
        }
        // Refresh history
        fetchHistory();
      } else {
        toast.error(data.message || 'Failed to cancel enquiry.');
      }
    } catch (err) {
      toast.error('Network error. Failed to cancel enquiry.');
    }
  };

  return (
    <div className="passenger-history-page" id="passenger-history-page">
      <div className="container">
        <div className="history-header">
          <div>
            <h1 className="section-title">Welcome, {user.customerName || 'Customer'} 👋</h1>
            <p className="section-subtitle">View your booking enquiries history or cancel active requests.</p>
          </div>
          <button 
            className="btn-secondary" 
            onClick={() => {
              localStorage.removeItem('passengerToken');
              localStorage.removeItem('passengerUser');
              toast.success('Logged out successfully.');
              navigate('/');
            }}
          >
            Logout
          </button>
        </div>

        {/* Display Passenger Notification Banner if one was received */}
        {notification && (
          <div className="notification-banner shadow-active" id="notification-banner">
            <div className="notification-icon">🔔</div>
            <div className="notification-body">
              <div className="notification-title">Passenger Notification Dispatch Successful</div>
              <p className="notification-text"><strong>To:</strong> {notification.to}</p>
              <p className="notification-text"><strong>Message sent:</strong> "{notification.message}"</p>
            </div>
            <button className="notification-close" onClick={() => setNotification(null)}>×</button>
          </div>
        )}

        {loading ? (
          <div className="loading-center">
            <div className="spinner"></div>
            <p>Fetching your records...</p>
          </div>
        ) : history.length === 0 ? (
          <div className="empty-state card">
            <div className="empty-icon">🚗</div>
            <h3>No booking history found</h3>
            <p>You haven't submitted any car recommendations or booking requests yet.</p>
            <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => navigate('/')}>
              Find a Car Now
            </button>
          </div>
        ) : (
          <div className="history-list">
            {history.map((item) => (
              <div className="history-item-card card" key={item.enquiry_id}>
                <div className="history-item-header">
                  <div>
                    <h3 className="enquiry-id-text">Enquiry #{item.enquiry_id}</h3>
                    <span className="enquiry-date">{new Date(item.created_at).toLocaleDateString()}</span>
                  </div>
                  <span className={`badge badge-${item.status === 'confirmed' ? 'success' : item.status === 'cancelled' ? 'error' : 'warning'}`}>
                    {item.status.toUpperCase()}
                  </span>
                </div>

                <div className="history-item-body">
                  <div className="history-spec-grid">
                    <div>
                      <strong>Trip Type:</strong> {item.trip_type}
                    </div>
                    <div>
                      <strong>Passengers:</strong> {item.passengers}
                    </div>
                    <div>
                      <strong>Luggage:</strong> {item.luggage}
                    </div>
                    <div>
                      <strong>Pickup:</strong> {item.pickup_location}
                    </div>
                    {item.drop_location && (
                      <div>
                        <strong>Drop:</strong> {item.drop_location}
                      </div>
                    )}
                    <div>
                      <strong>Trip Date:</strong> {new Date(item.trip_date).toLocaleDateString()}
                    </div>
                  </div>

                  {item.recommended_vehicle_id ? (
                    <div className="history-assigned-car shadow-nav">
                      <div className="assigned-car-icon">🚗</div>
                      <div>
                        <div className="assigned-car-name">{item.vehicle_name}</div>
                        <div className="assigned-car-price">Price: ₹{item.vehicle_price} / day</div>
                      </div>
                    </div>
                  ) : item.ai_recommendation ? (
                    <div className="history-assigned-car shadow-nav">
                      <div className="assigned-car-icon">🚗</div>
                      <div>
                        <div className="assigned-car-name">{item.ai_recommendation.vehicle_name || item.ai_recommendation.name}</div>
                        <div className="assigned-car-price">Price: ₹{item.ai_recommendation.price_per_day || item.ai_recommendation.price} / day</div>
                      </div>
                    </div>
                  ) : null}

                  {item.ai_recommendation && (
                    <div className="history-ai-reason">
                      <strong>🤖 AI Match Reason:</strong>
                      <p>{item.ai_recommendation.reason || item.ai_recommendation.recommendations?.[0]?.reason || 'AI recommendation processed.'}</p>
                    </div>
                  )}
                </div>

                <div className="history-item-actions">
                  <button 
                    className="btn-secondary cancel-erase-btn" 
                    onClick={() => handleCancelEnquiry(item.enquiry_id)}
                  >
                    🗑️ Cancel Request & Erase Record
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
