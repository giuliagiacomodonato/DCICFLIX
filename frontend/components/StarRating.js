'use client';

import { useState } from 'react';
import { FaStar, FaStarHalfAlt, FaRegStar } from 'react-icons/fa';

export default function StarRating({ onRate }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);

  // Función para manejar el movimiento del mouse sobre una estrella
  const handleMouseMove = (e, index) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const x = e.clientX - rect.left; // Coordenada X dentro de la estrella

    // Si el mouse está en la primera mitad (izquierda)
    if (x < width / 2) {
      setHover(index + 0.5);
    } else {
      setHover(index + 1);
    }
  };

  const handleClick = () => {
    setRating(hover);
    if (onRate) {
      onRate(hover);
    }
  };

  const handleMouseLeave = () => {
    setHover(0);
  };

  return (
    <div className="star-rating-container" style={{ display: 'flex', gap: '5px', fontSize: '2rem', cursor: 'pointer' }}>
      {[...Array(5)].map((_, i) => {
        const starValue = i + 1;
        
        // Determinar qué icono mostrar basado en hover o rating actual
        // Prioridad: Hover > Rating actual
        const currentDisplay = hover || rating;
        
        let Icon = FaRegStar;
        if (currentDisplay >= starValue) {
          Icon = FaStar;
        } else if (currentDisplay >= starValue - 0.5) {
          Icon = FaStarHalfAlt;
        }

        return (
          <div
            key={i}
            onMouseMove={(e) => handleMouseMove(e, i)}
            onMouseLeave={handleMouseLeave}
            onClick={handleClick}
            style={{ color: '#ffd700' }}
          >
            <Icon />
          </div>
        );
      })}
      <div style={{ marginLeft: '10px', fontSize: '1rem', color: '#fff', alignSelf: 'center' }}>
        {hover || rating || 0} / 5
      </div>
    </div>
  );
}
