'use client';

import { useRef } from 'react';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import MovieCard from './MovieCard';
import SkeletonCard from './SkeletonCard';

export default function MovieRow({ title, movies, loading, onMovieClick }) {
  const rowRef = useRef(null);

  const scroll = (direction) => {
    if (rowRef.current) {
      const { current } = rowRef;
      const scrollAmount = direction === 'left' ? -current.offsetWidth / 2 : current.offsetWidth / 2;
      current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <section className="category">
      <h2>{title}</h2>
      <div className="row-container">
        <button className="handle handle-left" onClick={() => scroll('left')}>
          <FaChevronLeft />
        </button>
        
        <div className="movies-row" ref={rowRef}>
          {loading ? (
            // Mostrar 10 skeletons mientras carga
            [...Array(10)].map((_, i) => <SkeletonCard key={i} />)
          ) : (
            movies.map((movie) => (
              <MovieCard 
                key={movie._id} 
                movie={movie} 
                onClick={() => onMovieClick(movie)} 
              />
            ))
          )}
        </div>

        <button className="handle handle-right" onClick={() => scroll('right')}>
          <FaChevronRight />
        </button>
      </div>
    </section>
  );
}
