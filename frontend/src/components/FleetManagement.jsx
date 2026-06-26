import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import BASE from '../api';
import './FleetManagement.css';

export default function FleetManagement() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('vehicles');
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form states for vehicle
  const [vehicleForm, setVehicleForm] = useState({
    name: '',
    category: 'standard',
    seats: 4,
    luggage_capacity: 'medium',
    price_per_day: '',
    quantity: 1,
    image_url: '',
    featuresString: 'AC, GPS, Music System'
  });

  // Form states for driver
  const [driverForm, setDriverForm] = useState({
    name: '',
    phone: '',
    license_no: ''
  });

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      navigate('/login');
      return;
    }
    fetchData(token);
  }, [activeTab]);

  const fetchData = async (token) => {
    setLoading(true);
    try {
      if (activeTab === 'vehicles') {
        const res = await fetch(`${BASE}/api/vehicles`);
        const result = await res.json();
        if (result.success) {
          setVehicles(result.data);
        } else {
          toast.error(result.message || 'Failed to fetch vehicles');
        }
      } else {
        const res = await fetch(`${BASE}/api/drivers`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await res.json();
        if (result.success) {
          setDrivers(result.data);
        } else {
          toast.error(result.message || 'Failed to fetch drivers');
        }
      }
    } catch (err) {
      toast.error('Network error. Failed to load fleet details.');
    } finally {
      setLoading(false);
    }
  };

  const handleVehicleSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('adminToken');
    if (!token) return;

    if (!vehicleForm.name || !vehicleForm.price_per_day) {
      toast.error('Please fill in all required fields.');
      return;
    }

    // Process comma separated features
    const features = vehicleForm.featuresString
      ? vehicleForm.featuresString.split(',').map(f => f.trim()).filter(Boolean)
      : [];

    const payload = {
      name: vehicleForm.name,
      category: vehicleForm.category,
      seats: parseInt(vehicleForm.seats),
      luggage_capacity: vehicleForm.luggage_capacity,
      price_per_day: parseFloat(vehicleForm.price_per_day),
      quantity: parseInt(vehicleForm.quantity || 1),
      features,
      image_url: vehicleForm.image_url || null
    };

    try {
      const res = await fetch(`${BASE}/api/vehicles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (result.success) {
        toast.success('Vehicle added to fleet successfully!');
        setVehicleForm({
          name: '',
          category: 'standard',
          seats: 4,
          luggage_capacity: 'medium',
          price_per_day: '',
          quantity: 1,
          image_url: '',
          featuresString: 'AC, GPS, Music System'
        });
        fetchData(token);
      } else {
        toast.error(result.message || 'Failed to add vehicle.');
      }
    } catch (err) {
      toast.error('Network error. Failed to save vehicle.');
    }
  };

  const handleDriverSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('adminToken');
    if (!token) return;

    if (!driverForm.name || !driverForm.phone) {
      toast.error('Name and Phone are required.');
      return;
    }

    try {
      const res = await fetch(`${BASE}/api/drivers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(driverForm)
      });
      const result = await res.json();
      if (result.success) {
        toast.success('Driver registered successfully!');
        setDriverForm({ name: '', phone: '', license_no: '' });
        fetchData(token);
      } else {
        toast.error(result.message || 'Failed to register driver.');
      }
    } catch (err) {
      toast.error('Network error. Failed to save driver.');
    }
  };

  const handleDeleteVehicle = async (id) => {
    const confirmed = await window.__showConfirmModal({
      title: 'Delete Vehicle?',
      message: 'This will permanently remove this vehicle model from the fleet. Existing bookings referencing it may be affected.',
      danger: true,
      confirmLabel: '🗑️ Delete Vehicle',
      cancelLabel: 'Cancel',
    });
    if (!confirmed) return;
    const token = localStorage.getItem('adminToken');
    try {
      const res = await fetch(`${BASE}/api/vehicles/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Vehicle deleted successfully.');
        fetchData(token);
      } else {
        toast.error(data.message || 'Failed to delete vehicle.');
      }
    } catch (err) {
      toast.error('Failed to delete vehicle due to connection error.');
    }
  };

  const handleDeleteDriver = async (id) => {
    const confirmed = await window.__showConfirmModal({
      title: 'Remove Driver?',
      message: 'This driver will be permanently removed from the system.',
      danger: true,
      confirmLabel: '🗑️ Remove Driver',
      cancelLabel: 'Cancel',
    });
    if (!confirmed) return;
    const token = localStorage.getItem('adminToken');
    try {
      const res = await fetch(`${BASE}/api/drivers/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Driver deleted successfully.');
        fetchData(token);
      } else {
        toast.error(data.message || 'Failed to delete driver.');
      }
    } catch (err) {
      toast.error('Failed to delete driver due to connection error.');
    }
  };

  return (
    <div className="fleet-management-page" id="fleet-management-page">
      <div className="container">
        {/* Page Header */}
        <div className="fleet-header">
          <div>
            <h1 className="section-title">Fleet Management 🛠️</h1>
            <p className="section-subtitle">Add and configure vehicle models and driver availability.</p>
          </div>
          
          <div className="tab-buttons">
            <button 
              className={`tab-btn ${activeTab === 'vehicles' ? 'active' : ''}`}
              onClick={() => setActiveTab('vehicles')}
              id="tab-btn-vehicles"
            >
              🚗 Manage Vehicles
            </button>
            <button 
              className={`tab-btn ${activeTab === 'drivers' ? 'active' : ''}`}
              onClick={() => setActiveTab('drivers')}
              id="tab-btn-drivers"
            >
              👥 Manage Drivers
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="fleet-content-grid">
          {/* Form side */}
          <div className="form-card card">
            {activeTab === 'vehicles' ? (
              <form onSubmit={handleVehicleSubmit} id="add-vehicle-form">
                <h3 className="form-title-text">Add New Vehicle</h3>
                
                <div className="form-group">
                  <label className="form-label">Vehicle Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Maruti Swift Dzire"
                    value={vehicleForm.name}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, name: e.target.value })}
                    required
                    id="vehicle-name-input"
                  />
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <select
                      className="form-select"
                      value={vehicleForm.category}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, category: e.target.value })}
                      id="vehicle-category-select"
                    >
                      <option value="budget">Budget</option>
                      <option value="standard">Standard</option>
                      <option value="premium">Premium</option>
                      <option value="luxury">Luxury</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Luggage Capacity</label>
                    <select
                      className="form-select"
                      value={vehicleForm.luggage_capacity}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, luggage_capacity: e.target.value })}
                      id="vehicle-luggage-select"
                    >
                      <option value="small">Small Boot</option>
                      <option value="medium">Medium Boot</option>
                      <option value="large">Large Boot</option>
                    </select>
                  </div>
                </div>

                <div className="grid-3">
                  <div className="form-group">
                    <label className="form-label">Seats</label>
                    <input
                      type="number"
                      className="form-input"
                      value={vehicleForm.seats}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, seats: e.target.value })}
                      min="2"
                      max="20"
                      required
                      id="vehicle-seats-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Price per Day (₹) *</label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="e.g. 1500"
                      value={vehicleForm.price_per_day}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, price_per_day: e.target.value })}
                      min="1"
                      required
                      id="vehicle-price-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Quantity *</label>
                    <input
                      type="number"
                      className="form-input"
                      value={vehicleForm.quantity}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, quantity: e.target.value })}
                      min="1"
                      required
                      id="vehicle-quantity-input"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Image URL</label>
                  <input
                    type="url"
                    className="form-input"
                    placeholder="https://images.unsplash.com/..."
                    value={vehicleForm.image_url}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, image_url: e.target.value })}
                    id="vehicle-image-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Features (comma separated)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={vehicleForm.featuresString}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, featuresString: e.target.value })}
                    id="vehicle-features-input"
                  />
                </div>

                <button type="submit" className="btn-primary btn-primary-full submit-btn" id="vehicle-submit-btn">
                  Add Vehicle to Fleet
                </button>
              </form>
            ) : (
              <form onSubmit={handleDriverSubmit} id="add-driver-form">
                <h3 className="form-title-text">Register New Driver</h3>

                <div className="form-group">
                  <label className="form-label">Driver Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Suresh Kumar"
                    value={driverForm.name}
                    onChange={(e) => setDriverForm({ ...driverForm, name: e.target.value })}
                    required
                    id="driver-name-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Phone Number *</label>
                  <input
                    type="tel"
                    className="form-input"
                    placeholder="e.g. +91 98765 43210"
                    value={driverForm.phone}
                    onChange={(e) => setDriverForm({ ...driverForm, phone: e.target.value })}
                    required
                    id="driver-phone-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">License Number</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. KA01 20201234"
                    value={driverForm.license_no}
                    onChange={(e) => setDriverForm({ ...driverForm, license_no: e.target.value })}
                    id="driver-license-input"
                  />
                </div>

                <button type="submit" className="btn-primary btn-primary-full submit-btn" id="driver-submit-btn">
                  Register Driver
                </button>
              </form>
            )}
          </div>

          {/* List side */}
          <div className="list-card card">
            <h3 className="list-title-text">
              {activeTab === 'vehicles' ? `Current Fleet (${vehicles.length})` : `Registered Drivers (${drivers.length})`}
            </h3>

            {loading ? (
              <div className="loading-center">
                <div className="spinner"></div>
                <p>Fetching data...</p>
              </div>
            ) : activeTab === 'vehicles' ? (
              vehicles.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">🚗</div>
                  <p>No vehicles added to the fleet yet.</p>
                </div>
              ) : (
                <div className="fleet-list-container">
                  {vehicles.map(v => (
                    <div className="fleet-item-row" key={v.vehicle_id}>
                      <div className="fleet-item-img-container">
                        {v.image_url ? (
                          <img src={v.image_url} alt={v.name} className="fleet-item-img" />
                        ) : (
                          <span className="fleet-item-no-img">🚗</span>
                        )}
                      </div>
                      <div className="fleet-item-details">
                        <div className="fleet-item-header">
                          <span className="fleet-item-name">{v.name}</span>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span className={`badge badge-info fleet-item-category`}>{v.category.toUpperCase()}</span>
                            <button 
                              type="button" 
                              onClick={() => handleDeleteVehicle(v.vehicle_id)} 
                              className="btn-ghost" 
                              style={{ padding: '2px 6px', color: 'var(--color-error-text)' }}
                              title="Delete Vehicle"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                        <div className="fleet-item-specs">
                          <span>👤 {v.seats} Seats</span>
                          <span>🧳 {v.luggage_capacity} Luggage</span>
                          <span className="fleet-item-qty">Qty: <strong>{v.quantity}</strong></span>
                        </div>
                        <div className="fleet-item-price-row">
                          <span className="fleet-item-price">₹ {v.price_per_day} / day</span>
                          <span className={`badge ${v.is_available ? 'badge-success' : 'badge-error'}`}>
                            {v.is_available ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              drivers.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">👥</div>
                  <p>No drivers registered yet.</p>
                </div>
              ) : (
                <div className="driver-list-container">
                  <table className="data-table">
                     <thead>
                      <tr>
                        <th>Driver Details</th>
                        <th>License No</th>
                        <th>Rating</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {drivers.map(d => (
                        <tr key={d.driver_id}>
                          <td>
                            <div className="td-name">{d.name}</div>
                            <div className="td-sub">{d.phone}</div>
                          </td>
                          <td>{d.license_no || <span className="text-muted">None</span>}</td>
                          <td>⭐ {d.rating ? d.rating.toFixed(1) : '5.0'}</td>
                          <td>
                            <span className={`badge ${d.is_available ? 'badge-success' : 'badge-warning'}`}>
                              {d.is_available ? 'Available' : 'Assigned'}
                            </span>
                          </td>
                          <td>
                            <button 
                              type="button" 
                              onClick={() => handleDeleteDriver(d.driver_id)} 
                              className="btn-ghost" 
                              style={{ padding: '4px 8px', color: 'var(--color-error-text)' }}
                              title="Delete Driver"
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
