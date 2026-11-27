import { Link, useLocation, useResolvedPath, type LinkProps } from 'react-router';
import { useTransitionNavigate } from '../transition';

const trimSlash = (path: string) => (path.length > 1 ? path.replace(/\/+$/, '') : path);

/**
 * Router link that plays the shared exit/enter transition before navigating.
 * Modified clicks, new-tab targets and downloads keep native behaviour.
 */
export function TransitionLink({ to, onClick, target, download, reloadDocument, ...rest }: LinkProps) {
  const navigateWithTransition = useTransitionNavigate();
  const location = useLocation();
  const destination = useResolvedPath(to);

  return (
    <Link
      {...rest}
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
