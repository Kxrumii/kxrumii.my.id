import type { Ref } from 'react';
import { Link, useLocation, useResolvedPath, type LinkProps } from 'react-router';
import { useTransitionNavigate } from '../transition';

const trimSlash = (path: string) => (path.length > 1 ? path.replace(/\/+$/, '') : path);

interface TransitionLinkProps extends LinkProps {
  ref?: Ref<HTMLAnchorElement>;
}

/**
 * Router link yang memainkan transisi exit/enter bersama sebelum navigasi.
 * Klik dengan modifier, target tab baru, dan download tetap perilaku native.
 */
export function TransitionLink({ to, onClick, target, download, reloadDocument, ref, ...rest }: TransitionLinkProps) {
  const navigateWithTransition = useTransitionNavigate();
  const location = useLocation();
  const destination = useResolvedPath(to);

  return (
    <Link
      {...rest}
      ref={ref}
      to={to}
      target={target}
      download={download}
      reloadDocument={reloadDocument}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        if ((target && target !== '_self') || download || reloadDocument) return;
        event.preventDefault();
        const samePlace =
          trimSlash(destination.pathname) === trimSlash(location.pathname) && destination.search === location.search;
        if (samePlace) return;
        void navigateWithTransition(to);
      }}
    />
  );
}
