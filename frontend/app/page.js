'use client';

import { useState, useEffect } from 'react';
import MovieRow from '../components/MovieRow';
import Modal from '../components/Modal';

export default function Home() {
  const [randomMovies, setRandomMovies] = useState([]);
  const [popularMovies, setPopularMovies] = useState([]);
  const [trendingMovies, setTrendingMovies] = useState([]);
  const [newMovies, setNewMovies] = useState([]);
  const [actionMovies, setActionMovies] = useState([]);
  const [comedyMovies, setComedyMovies] = useState([]);
  
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAllMovies = async () => {
      try {
        // 1. Trending Movies (TMDB via Movies Service)
        fetch('http://localhost:3001/movies/trending')
          .then(res => res.json())
          .then(data => setTrendingMovies(data))
          .catch(err => console.error('Error trending:', err));

        // 2. Random Movies (Servicio Random)
        fetch('http://localhost:3002/random/10')
          .then(res => res.json())
          .then(data => setRandomMovies(data))
          .catch(err => console.error('Error random:', err));

        // 3. Popular Movies (Rating > 8.5)
        fetch('http://localhost:3001/movies/search?minRating=8.5&sort=imdb.rating&desc=true&limit=10')
          .then(res => res.json())
          .then(data => setPopularMovies(data))
          .catch(err => console.error('Error popular:', err));

        // 4. New Movies (Year >= 2015)
        fetch('http://localhost:3001/movies/search?minYear=2015&sort=year&desc=true&limit=10')
          .then(res => res.json())
          .then(data => setNewMovies(data))
          .catch(err => console.error('Error new:', err));

        // 5. Action Movies
        fetch('http://localhost:3001/movies/search?genre=Action&limit=10')
          .then(res => res.json())
          .then(data => setActionMovies(data))
          .catch(err => console.error('Error action:', err));

        // 6. Comedy Movies
        fetch('http://localhost:3001/movies/search?genre=Comedy&limit=10')
          .then(res => res.json())
          .then(data => setComedyMovies(data))
          .catch(err => console.error('Error comedy:', err));

        // Simular un pequeño delay para ver los skeletons (opcional, pero ayuda a UX si es muy rápido)
        setTimeout(() => setLoading(false), 1000);
        
      } catch (err) {
        console.error('Error fetching movies:', err);
        setLoading(false);
      }
    };

    fetchAllMovies();
  }, []);

  const handleMovieClick = (movie) => {
    setSelectedMovie(movie);
    // Enviar evento de click
    sendInteraction(movie, 'click');
  };

  const handleCloseModal = () => {
    setSelectedMovie(null);
  };

  const sendInteraction = async (movie, type, ratingValue = null) => {
    // Generar ID de usuario simple si no existe
    let userId = localStorage.getItem('dcicflix_user_id');
    if (!userId) {
      userId = 'user_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('dcicflix_user_id', userId);
    }

    const payload = {
      userId: userId,
      movieId: movie._id,
      movieTitle: movie.title,
      type: type
    };

    if (type === 'rating' && ratingValue !== null) {
      payload.rating = ratingValue;
    }

    try {
      await fetch('http://localhost:3003/api/calificaciones', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      console.log(`Interaction sent: ${type} ${ratingValue || ''}`);
    } catch (error) {
      console.error('Error sending interaction:', error);
    }
  };

  return (
    <div>
      <section className="hero">
        <div className="hero-content">
          <h1>Película Destacada</h1>
          <p>Explora el universo de películas aleatorias...</p>
        </div>
      </section>

      <MovieRow 
        title="Tendencias (TMDB)" 
        movies={trendingMovies} 
        loading={loading} 
        onMovieClick={handleMovieClick} 
      />

      <MovieRow 
        title="Películas Aleatorias" 
        movies={randomMovies} 
        loading={loading} 
        onMovieClick={handleMovieClick} 
      />

      <MovieRow 
        title="Populares en DCICFLIX" 
        movies={popularMovies} 
        loading={loading} 
        onMovieClick={handleMovieClick} 
      />

      <MovieRow 
        title="Nuevos Lanzamientos" 
        movies={newMovies} 
        loading={loading} 
        onMovieClick={handleMovieClick} 
      />

      <MovieRow 
        title="Acción" 
        movies={actionMovies} 
        loading={loading} 
        onMovieClick={handleMovieClick} 
      />

      <MovieRow 
        title="Comedia" 
        movies={comedyMovies} 
        loading={loading} 
        onMovieClick={handleMovieClick} 
      />

      {selectedMovie && (
        <Modal 
          movie={selectedMovie} 
          onClose={handleCloseModal} 
          onRate={(rating) => sendInteraction(selectedMovie, 'rating', rating)}
        />
      )}
    </div>
  );
}
