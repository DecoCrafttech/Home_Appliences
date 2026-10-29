import { useEffect, useRef, type ButtonHTMLAttributes } from "react";
import { useLocation, useNavigate, useNavigationType } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa6";

export function AppBackButton({
  fallback,
  children = "Back",
  onClick,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { fallback: string }) {
  const navigate = useNavigate();
  return (
    <button
      {...props}
      type="button"
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        if ((window.history.state?.idx || 0) > 0) void navigate(-1);
        else void navigate(fallback);
      }}
    >
      <FaArrowLeft aria-hidden="true" /> {children}
    </button>
  );
}

/** New destinations open at the top; history navigation keeps browser restoration. */
export function NavigationScroll() {
  const { pathname } = useLocation(),
    navigationType = useNavigationType();
  const previousPath = useRef(pathname);
  useEffect(() => {
    if (previousPath.current !== pathname && navigationType !== "POP")
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    previousPath.current = pathname;
  }, [pathname, navigationType]);
  return null;
}
