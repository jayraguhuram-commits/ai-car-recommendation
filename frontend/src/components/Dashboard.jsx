import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import BASE from '../api';
import './Dashboard.css';

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [enquiries, setEnquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      navigate('/login');
      return;
    }
    fetchData(token);
  }, [filterStatus, search]);

  const fetchData = async (token) => {
    setLoading(true);
    try {
      // Fetch stats
      const statsRes = await fetch(`${BASE}/api/dashboard/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const statsData = await statsRes.json();
      if (statsData.success) setStats(statsData.data);

      // Fetch enquiries list
      const query = new URLSearchParams();
      if (filterStatus) query.append('status', filterStatus);
      if (search) query.append('search', search);

      const enqRes = await fetch(`${BASE}/api/enquiries?${query.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const enqData = await enqRes.json();
      if (enqData.success) setEnquiries(enqData.data);

    } catch (err) {
      toast.error('Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'confirmed': return <span className="badge badge-success">✅ Confirmed</span>;
      case 'pending': return <span className="badge badge-warning">⏳ Pending</span>;
      case 'cancelled': return <span className="badge badge-error">❌ Cancelled</span>;
      default: return <span className="badge badge-info">{status}</span>;
    }
  };

  return (
    <div className="dashboard-page" id="dashboard-page">
      <div className="container">
        <div className="dashboard-header">
          <div>
            <h1 className="section-title">Good Morning, Admin 👋</h1>
            <p className="section-subtitle">Here's what's happening today.</p>
          </div>
          {/* <button className="btn-primary" id="add-manual-btn">+ Add Manual Booking</button> */}
        </div>

        {/* KPI Strip */}
        <div className="kpi-strip grid-4" id="kpi-strip">
          <div className="kpi-card card">
            <div className="kpi-icon">📋</div>
            <div className="kpi-title">Total Enquiries</div>
            <div className="kpi-value">{stats?.totalEnquiries || 0}</div>
          </div>
          <div className="kpi-card card">
            <div className="kpi-icon">✅</div>
            <div className="kpi-title">Confirmed</div>
            <div className="kpi-value">{stats?.confirmed || 0}</div>
          </div>
          <div className="kpi-card card">
            <div className="kpi-icon">⏳</div>
            <div className="kpi-title">Pending</div>
            <div className="kpi-value">{stats?.pending || 0}</div>
          </div>
          <div className="kpi-card card">
            <div className="kpi-icon">🚗</div>
            <div className="kpi-title">Fleet Active</div>
            <div className="kpi-value">{stats?.fleetActive || 0} / {stats?.fleetTotal || 0}</div>
          </div>
        </div>

        {/* Enquiry Table Section */}
        <div className="table-card card" id="enquiry-table-card">
          <div className="table-header">
            <h2 className="table-title">Recent Enquiries</h2>
            <div className="table-filters">
              <input
                type="text"
                className="form-input"
                placeholder="Search name or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                id="search-enquiries"
              />
              <select
                className="form-select"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                id="filter-status"
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="table-responsive">
            <table className="data-table" id="enquiries-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Car Assigned</th>
                  <th>Trip Date</th>
                  <th>Budget</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="6" className="text-center py-4">Loading...</td></tr>
                ) : enquiries.length === 0 ? (
                  <tr><td colSpan="6" className="text-center py-4">No enquiries found.</td></tr>
                ) : (
                  enquiries.map(enq => (
                    <tr key={enq.enquiry_id}>
                      <td>
                        <div className="td-name">{enq.customer_name}</div>
                        <div className="td-sub">{enq.phone}</div>
                      </td>
                      <td>
                        {enq.vehicle_name || (() => {
                          if (enq.ai_recommendation) {
                            try {
                              const parsed = JSON.parse(enq.ai_recommendation);
                              return parsed?.vehicle_name;
                            } catch (e) {}
                          }
                          return null;
                        })() || <span className="text-muted">None</span>}
                      </td>
                      <td>{new Date(enq.trip_date).toLocaleDateString()}</td>
                      <td>
                        {enq.budget_max ? `₹${enq.budget_min} - ₹${enq.budget_max}` : 'Not set'}
                      </td>
                      <td>{getStatusBadge(enq.status)}</td>
                      <td>
                        <Link to={`/booking/${enq.enquiry_id}`} className="btn-secondary btn-sm">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
