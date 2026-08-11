import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { SourceLinks } from '../components/SourceLinks';
import { api } from '../lib/api';
export function ImageDetailPage() {
  const { name = '' } = useParams();
  const [data, setData] = useState<any>();
  useEffect(() => {
    void api.getImage(name).then(setData);
  }, [name]);
  if (!data) return <p>Loading image metadata…</p>;
  if (!data.found) return <p>Image not found in current metadata.</p>;
  const image = data.image;
  return (
    <section>
      <div className="detail-heading">
        {image.logoUrl && (
          <img src={image.logoUrl} alt="" width="104" height="104" />
        )}
        <div className="page-heading">
          <span>Image detail</span>
          <h1>{image.displayName ?? image.name}</h1>
          <p>{image.description}</p>
        </div>
      </div>
      <dl className="metadata">
        <div>
          <dt>Categories</dt>
          <dd>{image.categories?.join(', ') || 'Not provided'}</dd>
        </div>
        <div>
          <dt>Architectures</dt>
          <dd>{image.architectures?.join(', ') || 'Not provided'}</dd>
        </div>
        <div>
          <dt>Tags</dt>
          <dd>{image.tags?.join(', ') || 'Not provided'}</dd>
        </div>
        <div>
          <dt>Latest version</dt>
          <dd>{image.latestVersion ?? 'Not provided'}</dd>
        </div>
        <div>
          <dt>Last build</dt>
          <dd>{image.lastBuild ?? 'Not provided'}</dd>
        </div>
      </dl>
      <Link className="primary" to={`/audit?image=${image.name}`}>
        Audit this image
      </Link>
      <SourceLinks
        links={Object.values(image.links).filter(Boolean) as string[]}
      />
    </section>
  );
}
