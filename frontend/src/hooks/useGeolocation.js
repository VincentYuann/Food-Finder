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
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        let areaName = null;

        try {
          // Attempt lightweight reverse geocode to give the user area visibility
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3500);
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
            {
              headers: { Accept: 'application/json' },
              signal: controller.signal,
            }
          );
          clearTimeout(timeoutId);
          if (res.ok) {
            const data = await res.json();
            const addr = data.address || {};
            const sub = addr.neighbourhood || addr.suburb || addr.borough || addr.district;
            const city = addr.city || addr.town || addr.village || addr.county;
            const state = addr.state;
            if (sub && city) {
              areaName = `${sub}, ${city}`;
            } else if (city && state) {
              areaName = `${city}, ${state}`;
            } else if (data.name) {
              areaName = data.name;
            }
          }
        } catch {
          // Reverse-geocoding is purely an enhancement; silent fallback to coordinates
        }

        setLocation({
          latitude,
          longitude,
          accuracy: Math.round(accuracy),
          areaName,
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
