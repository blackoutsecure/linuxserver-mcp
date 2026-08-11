import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ImageSearch } from '../components/ImageSearch';
import { api } from '../lib/api';
import type { Image } from '../lib/types';
export function ImageSearchPage() {
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('query') ?? '';
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState('');
  const [architecture, setArchitecture] = useState('');
  const [tag, setTag] = useState('');
  const [results, setResults] = useState<Image[]>([]);
  const [error, setError] = useState('');
  const search = async (searchQuery = query) => {
    setError('');
    try {
      const params = new URLSearchParams({
        query: searchQuery,
        ...(category && { category }),
        ...(architecture && { architecture }),
        ...(tag && { tag })
      });
      setResults((await api.searchImages(params)).results);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Search failed');
    }
  };
  useEffect(() => {
    if (initialQuery) void search(initialQuery);
  }, []);
  return (
    <section>
      <div className="page-heading">
        <span>Image catalog</span>
        <h1>Search images</h1>
        <p>
          Exact names rank first, followed by related metadata and recent
          builds.
        </p>
      </div>
      <ImageSearch
        value={query}
        onChange={setQuery}
        onSubmit={() => void search()}
      />
      <div className="filters">
        <input
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          placeholder="Category"
        />
        <select
          value={architecture}
          onChange={(event) => setArchitecture(event.target.value)}
        >
          <option value="">Any architecture</option>
          <option>x86_64</option>
          <option>arm64</option>
        </select>
        <input
          value={tag}
          onChange={(event) => setTag(event.target.value)}
          placeholder="Tag"
        />
      </div>
      {error && <p className="error">{error}</p>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Image</th>
              <th>Categories</th>
              <th>Architectures</th>
              <th>Last build</th>
            </tr>
          </thead>
          <tbody>
            {results.map((image) => (
              <tr key={image.name}>
                <td>
                  <div className="image-cell">
                    {image.logoUrl && (
                      <img
                        src={image.logoUrl}
                        alt=""
                        width="42"
                        height="42"
                        loading="lazy"
                      />
                    )}
                    <div>
                      <Link to={`/images/${image.name}`}>
                        <strong>{image.displayName ?? image.name}</strong>
                      </Link>
                      <small>{image.description}</small>
                    </div>
                  </div>
                </td>
                <td>{image.categories?.join(', ') || '—'}</td>
                <td>{image.architectures?.join(', ') || '—'}</td>
                <td>{image.lastBuild ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
