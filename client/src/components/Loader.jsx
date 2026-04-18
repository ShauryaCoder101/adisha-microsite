export default function Loader({ text = 'Loading...' }) {
  return (
    <div className="loader">
      <div className="loader-spinner"></div>
      <p className="loader-text">{text}</p>
    </div>
  );
}
