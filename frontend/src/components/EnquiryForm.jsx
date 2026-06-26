import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import BASE from '../api';
import './EnquiryForm.css';

export default function EnquiryForm() {
  const navigate = useNavigate();
  const [selectedCar, setSelectedCar] = useState(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    customer_name: '', phone: '', email: '',
    pickup_location: '', drop_location: '',
    trip_date: '', return_date: '',
    special_requirements: ''
  });

  useEffect(() => {
    const saved = sessionStorage.getItem('selectedCar');
    if (saved) setSelectedCar(JSON.parse(saved));

    const savedForm = sessionStorage.getItem('recommendForm');
    if (savedForm) {
      const rf = JSON.parse(savedForm);
      setForm(prev => ({ ...prev, trip_date: rf.tripDate || '' }));
    }
  }, []);

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const savedForm = JSON.parse(sessionStorage.getItem('recommendForm') || '{}');

    const payload = {
      ...form,
      trip_type: savedForm.tripType || 'General',
      passengers: savedForm.passengers || 1,
      luggage: savedForm.luggage || 'Not specified',
      comfort_pref: savedForm.comfortPref || 'standard',
      budget_min: savedForm.budgetMin || 0,
      budget_max: savedForm.budgetMax || 0,
      ai_recommendation: selectedCar || null,
      recommended_vehicle_id: selectedCar?.vehicle_id || null
    };

    try {
      const res = await fetch(`${BASE}/api/enquiries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        toast.success('✅ Enquiry submitted! We will contact you shortly.');
        sessionStorage.removeItem('selectedCar');
        sessionStorage.removeItem('recommendForm');
        setTimeout(() => navigate('/'), 2000);
      } else {
        toast.error(data.message || 'Failed to submit enquiry.');
      }
    } catch (err) {
      toast.error('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="enquiry-page" id="enquiry-page">
      <div className="container">
        <div className="enquiry-header">
          <Link to="/results" className="back-link" id="back-to-results">← Back to Results</Link>
          <h1 className="section-title">Book Your Car</h1>
          <p className="section-subtitle">Fill in your details and we'll confirm your booking.</p>
        </div>

        <div className="enquiry-layout">
          {/* Selected Car Preview */}
          {selectedCar && (
            <div className="selected-car-card card" id="selected-car-preview">
              <div className="selected-car-label">Selected Car</div>
              <div className="selected-car-info">
                <span className="selected-car-icon">🚗</span>
                <div>
                  <div className="selected-car-name">{selectedCar.vehicle_name}</div>
                  <div className="selected-car-price">₹{selectedCar.price_per_day?.toLocaleString('en-IN')}/day</div>
                </div>
              </div>
              <Link to="/results" className="change-car-link" id="change-car-btn">Change Car →</Link>
            </div>
          )}

          {/* Enquiry Form */}
          <div className="enquiry-form-card card" id="enquiry-form-card">
            <form onSubmit={handleSubmit} id="enquiry-form">
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label" htmlFor="customer_name">Full Name *</label>
                  <input id="customer_name" name="customer_name" className="form-input"
                    placeholder="Your full name" value={form.customer_name}
                    onChange={handleChange} required />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="phone">Phone Number *</label>
                  <input id="phone" name="phone" className="form-input" type="tel"
                    placeholder="+91 98765 43210" value={form.phone}
                    onChange={handleChange} required />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="email">Email Address</label>
                <input id="email" name="email" className="form-input" type="email"
                  placeholder="your@email.com" value={form.email} onChange={handleChange} />
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label" htmlFor="pickup_location">Pickup Location *</label>
                  <input id="pickup_location" name="pickup_location" className="form-input"
                    placeholder="e.g. Bangalore Airport" value={form.pickup_location}
                    onChange={handleChange} required />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="drop_location">Drop Location</label>
                  <input id="drop_location" name="drop_location" className="form-input"
                    placeholder="e.g. MG Road, Bangalore" value={form.drop_location}
                    onChange={handleChange} />
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label" htmlFor="trip_date">📅 Trip Date *</label>
                  <input id="trip_date" name="trip_date" className="form-input" type="date"
                    value={form.trip_date} onChange={handleChange} required
                    min={new Date().toISOString().split('T')[0]} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="return_date">📅 Return Date</label>
                  <input id="return_date" name="return_date" className="form-input" type="date"
                    value={form.return_date} onChange={handleChange}
                    min={form.trip_date || new Date().toISOString().split('T')[0]} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="special_requirements">Special Requirements</label>
                <textarea id="special_requirements" name="special_requirements"
                  className="form-textarea" rows={4}
                  placeholder="Any special requests, pickup instructions, or notes..."
                  value={form.special_requirements} onChange={handleChange} />
              </div>

              <button
                type="submit"
                className="btn-primary btn-primary-full submit-enquiry-btn"
                id="submit-enquiry-btn"
                disabled={loading}
              >
                {loading ? '⏳ Submitting...' : '✅ SUBMIT ENQUIRY'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
