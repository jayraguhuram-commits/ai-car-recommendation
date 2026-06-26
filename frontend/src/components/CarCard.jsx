import { useNavigate } from 'react-router-dom';
import './CarCard.css';

/* ── SVG Icons (Skill rule: use SVG, not emoji) ── */
const IconUsers = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const IconLuggage = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="6" y="4" width="12" height="16" rx="2"/><path d="M9 4V2h6v2"/><line x1="12" y1="9" x2="12" y2="15"/><line x1="9" y1="12" x2="15" y2="12"/>
  </svg>
);
const IconTarget = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
  </svg>
);
const IconBot = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/>
    <line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/>
  </svg>
);
const IconCar = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v9a2 2 0 0 1-2 2h-1"/>
    <circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>
  </svg>
);
const IconArrow = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
  </svg>
);
const IconStar = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/>
  </svg>
);

const RANK_CONFIG = {
  1: { label: 'Top Pick',  className: 'rank-top',      badgeClass: 'badge-gold',    Icon: IconStar },
  2: { label: 'Standard', className: 'rank-standard', badgeClass: 'badge-neutral', Icon: null },
  3: { label: 'Budget',   className: 'rank-budget',   badgeClass: 'badge-info',    Icon: null }
};

const LUGGAGE_MAP = {
  small:  'Small Boot',
  medium: 'Medium Boot',
  large:  'Large Boot'
};

export default function CarCard({ rec, formData }) {
  const navigate = useNavigate();
  const rankInfo = RANK_CONFIG[rec.rank] || RANK_CONFIG[3];

  const luggageLabel = rec.category === 'budget'
    ? LUGGAGE_MAP.small
    : (rec.category === 'premium' || rec.category === 'luxury')
    ? LUGGAGE_MAP.large
    : LUGGAGE_MAP.medium;

  const handleBookNow = () => {
    sessionStorage.setItem('selectedCar', JSON.stringify(rec));
    navigate('/enquiry');
  };

  return (
    <article
      className={`car-card card ${rankInfo.className}`}
      id={`car-card-rank-${rec.rank}`}
      aria-label={`${rec.vehicle_name} — Rank ${rec.rank}`}
    >
      {/* Rank Badge */}
      <div className={`car-rank-badge badge ${rankInfo.badgeClass}`}>
        {rankInfo.Icon && <rankInfo.Icon />}
        {rankInfo.label}
      </div>

      {/* Car Image / Fallback icon */}
      {rec.image_url ? (
        <div className="car-image-container">
          <img src={rec.image_url} alt={`${rec.vehicle_name} vehicle`} className="car-image" loading="lazy" />
        </div>
      ) : (
        <div className="car-icon-box" role="img" aria-label={`${rec.vehicle_name} illustration`}>
          <IconCar />
        </div>
      )}

      {/* Car Name & Availability */}
      <div className="car-header-row">
        <h3 className="car-name" id={`car-name-${rec.rank}`}>{rec.vehicle_name}</h3>
        {rec.quantity && (
          <span className="car-qty badge badge-success" aria-label={`${rec.quantity} available`}>
            {rec.quantity} Available
          </span>
        )}
      </div>

      {/* Specs */}
      <div className="car-specs" role="list" aria-label="Vehicle specifications">
        <span className="car-spec" role="listitem">
          <IconUsers />
          {rec.seats} Seats
        </span>
        <span className="car-spec" role="listitem">
          <IconLuggage />
          {luggageLabel}
        </span>
        {rec.suitability_score && (
          <span className="car-spec car-score" role="listitem" aria-label={`${rec.suitability_score}% match`}>
            <IconTarget />
            {rec.suitability_score}% Match
          </span>
        )}
      </div>

      {/* Price */}
      <div className="car-price" id={`car-price-${rec.rank}`} aria-label={`Price: ₹${rec.price_per_day?.toLocaleString('en-IN')} per day`}>
        ₹{rec.price_per_day?.toLocaleString('en-IN')}
        <span className="car-price-unit"> / day</span>
      </div>

      {/* AI Reason */}
      {rec.reason && (
        <p className="car-reason" aria-label="AI recommendation reason">
          <span className="car-reason-icon"><IconBot /></span>
          {rec.reason}
        </p>
      )}

      {/* Book Now */}
      <button
        className="btn-primary btn-primary-full book-btn"
        id={`book-btn-${rec.rank}`}
        onClick={handleBookNow}
        aria-label={`Book ${rec.vehicle_name}`}
        type="button"
      >
        Book Now <IconArrow />
      </button>
    </article>
  );
}
