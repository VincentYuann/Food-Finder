import { useState, useCallback } from 'react';

export function useGeolocation() {
  const [location, setLocation] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState(null);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setIsLocating(false);
      },
      (error) => {
        setLocationError(`Location error: ${error.message}`);
        setIsLocating(false);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }, []);

  const clearLocation = useCallback(() => {
    setLocation(null);
    setLocationError(null);
  }, []);

  return {
    location,
    isLocating,
    locationError,
    requestLocation,
    clearLocation,
  };
}
