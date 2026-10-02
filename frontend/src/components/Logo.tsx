import { Link } from "react-router-dom";

export function Logo() {
  return (
    <Link
      to="/"
      className="focus-ring flex min-h-11 items-center rounded-sm"
      aria-label="Falcon home"
    >
      <img
        src="/falcon-logo@1x.png"
        srcSet="/falcon-logo@1x.png 1x, /falcon-logo@2x.png 2x, /falcon-logo@3x.png 3x"
        alt="Falcon"
        width="120"
        height="40"
        className="block h-10 w-[7.5rem] shrink-0 object-contain"
      />
    </Link>
  );
}
