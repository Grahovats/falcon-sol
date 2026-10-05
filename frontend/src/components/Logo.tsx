import { Link } from "react-router-dom";

export function Logo() {
  return (
    <Link
      to="/"
      className="brand-mark focus-ring flex min-h-12 items-center rounded-sm"
      aria-label="Falcon home"
    >
      <img
        src="/falcon-logo@1x.png"
        srcSet="/falcon-logo@1x.png 1x, /falcon-logo@2x.png 2x, /falcon-logo@3x.png 3x"
        alt="Falcon"
        width="128"
        height="40"
        className="block h-10 w-32 shrink-0 object-contain"
      />
    </Link>
  );
}
