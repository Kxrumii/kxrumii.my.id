/**
 * Flat (2D) atmosphere behind and over the room: light leaks, film grain and dust. It sits outside the 3D chain, so it
 * is the only place where blend/opacity layers are used, and it is a handful of static elements.
 */
export function AtmosphereLayer() {
  return (
    <div className="atmosphere" aria-hidden="true">
      <i className="atmosphere-leak atmosphere-leak-a" />
      <i className="atmosphere-leak atmosphere-leak-b" />
      <i className="atmosphere-dust" />
      <i className="atmosphere-grain" />
    </div>
  );
}
