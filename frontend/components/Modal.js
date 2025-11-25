import StarRating from './StarRating';

export default function Modal({ movie, onClose, onRate }) {
  if (!movie) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>&times;</button>
        
        <div className="modal-poster">
          <img 
            src={movie.poster || `https://ui-avatars.com/api/?name=${encodeURIComponent(movie.title)}&background=333&color=fff&size=500&length=2&font-size=0.4`} 
            alt={movie.title} 
          />
        </div>
        
        <div className="modal-info">
          <h2>{movie.title}</h2>
          <div className="modal-meta">
            <span>{movie.year || 'N/A'}</span>
            <span>{movie.runtime ? `${movie.runtime} min` : 'N/A'}</span>
            <span>{movie.imdb?.rating ? `IMDb: ${movie.imdb.rating}` : ''}</span>
          </div>
          
          <p style={{ lineHeight: '1.6', fontSize: '1.1rem' }}>
            {movie.fullplot || movie.plot || 'Sin descripción disponible.'}
          </p>
          
          <div className="modal-genres">
            {movie.genres && movie.genres.map((genre, index) => (
              <span key={index} className="genre-tag">{genre}</span>
            ))}
          </div>

          <div className="modal-rating-section">
            <h3>Calificar:</h3>
            <StarRating onRate={onRate} />
          </div>
        </div>
      </div>
    </div>
  );
}
