// hooks/useSectionCounts.js
import { useEffect, useState } from 'react';
import { subscribeSectionCounts } from './sanityAPI';

export default function useSectionCounts() {
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeSectionCounts({
      onData: (map) => {
        setCounts(map);
        setLoading(false);
      },
    });
    return () => unsub();
  }, []);

  return { counts, loading };
}
