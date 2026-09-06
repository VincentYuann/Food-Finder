/**
 * Geocode a neighborhood or city string into coordinates { latitude, longitude, areaName }
 * Uses OpenStreetMap Nominatim (free, client-side, zero Google API cost).
 *
 * @param {string} rawQuery - Location string like "University City", "Fishtown", "Brooklyn, NY"
 * @returns {Promise<{ latitude: number, longitude: number, areaName: string } | null>}
 */
export async function geocodeLocation(rawQuery) {
  if (!rawQuery || !rawQuery.trim()) return null;
  const q = rawQuery.trim();

  // If query doesn't specify a city/state, try biasing toward Philadelphia, PA first
  const queriesToTry = [];
  if (!q.includes(',')) {
    queriesToTry.push(`${q}, Philadelphia, PA`);
  }
  queriesToTry.push(q);

  for (const queryStr of queriesToTry) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(queryStr)}&format=json&limit=1`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'FoodFinder-App/1.0',
          'Accept': 'application/json',
        },
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data[0]) {
          const parts = data[0].display_name.split(',');
          const shortName = parts.slice(0, 2).join(',').trim();
          return {
            latitude: parseFloat(data[0].lat),
            longitude: parseFloat(data[0].lon),
            areaName: shortName,
          };
        }
      }
    } catch (e) {
      console.warn('Geocoding error for', queryStr, e);
    }
  }

  return null;
}
