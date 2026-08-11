import { Search } from 'lucide-react';
export function ImageSearch({
  value,
  onChange,
  onSubmit
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="search-box">
      <Search />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => event.key === 'Enter' && onSubmit()}
        placeholder="Search images"
        aria-label="Image name"
      />
      <button onClick={onSubmit}>Search</button>
    </div>
  );
}
