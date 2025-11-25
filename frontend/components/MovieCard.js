import Image from 'next/image';

export default function MovieCard({ movie, onClick }) {
  const posterUrl = movie.poster || `https://ui-avatars.com/api/?name=${encodeURIComponent(movie.title)}&background=333&color=fff&size=300&length=2&font-size=0.4`;

  return (
    <div 
      className="movie-card" 
      onClick={onClick}
      style={{ 
        flex: '0 0 200px', 
        cursor: 'pointer', 
        transition: 'transform 0.3s',
        position: 'relative'
      }}
      onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
      onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
    >
      <div style={{ position: 'relative', width: '100%', height: '300px' }}>
        <img 
          src={posterUrl} 
          alt={movie.title} 
          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }}
        />
      </div>
      <div className="movie-info" style={{ padding: '10px 0', textAlign: 'center' }}>
        <div className="movie-title" style={{ 
          fontSize: '0.9rem', 
          whiteSpace: 'nowrap', 
          overflow: 'hidden', 
          textOverflow: 'ellipsis' 
        }}>
          {movie.title}
        </div>
      </div>
    </div>
  );
}
