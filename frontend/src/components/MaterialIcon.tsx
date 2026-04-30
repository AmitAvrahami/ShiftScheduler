/**
 * Material Symbols icon wrapper.
 *
 * Uses the Google Material Symbols font already linked in index.html.
 *
 * @param {Object}  props
 * @param {string}  props.name      - Icon ligature name (e.g. "dashboard")
 * @param {boolean} [props.fill]    - Whether to render the filled variant
 * @param {string}  [props.className]
 * @param {React.CSSProperties} [props.style]
 */
export default function MaterialIcon({
  name,
  fill = false,
  className = '',
  style = {},
}: {
  name: string;
  fill?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className={`material-symbols-outlined select-none ${className}`}
      style={{
        ...style,
        fontVariationSettings: fill
          ? "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24"
          : "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
      }}
    >
      {name}
    </span>
  );
}
