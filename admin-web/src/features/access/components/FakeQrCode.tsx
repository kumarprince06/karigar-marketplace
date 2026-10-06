const QR_GRID_SIZE = 23;
const FINDER_SIZE = 7;
const FINDER_ORIGINS = [
  [0, 0],
  [QR_GRID_SIZE - FINDER_SIZE, 0],
  [0, QR_GRID_SIZE - FINDER_SIZE],
] as const;

/** True when the cell at (column, row) is dark. Three finder squares plus a fixed pseudo-random fill. */
function isDarkCell(column: number, row: number): boolean {
  const finderOrigin = FINDER_ORIGINS.find(
    ([originColumn, originRow]) =>
      column >= originColumn &&
      column < originColumn + FINDER_SIZE &&
      row >= originRow &&
      row < originRow + FINDER_SIZE,
  );
  if (!finderOrigin) return (column * 7 + row * 13 + column * row) % 5 < 2;
  const offsetColumn = column - finderOrigin[0];
  const offsetRow = row - finderOrigin[1];
  const isFinderBorder = offsetColumn === 0 || offsetColumn === 6 || offsetRow === 0 || offsetRow === 6;
  const isFinderCentre = offsetColumn > 1 && offsetColumn < 5 && offsetRow > 1 && offsetRow < 5;
  return isFinderBorder || isFinderCentre;
}

/** Row-major list of dark/light cells for the whole grid. Deterministic, so the design never changes. */
function buildFakeQrCells(): boolean[] {
  return Array.from({ length: QR_GRID_SIZE * QR_GRID_SIZE }, (_, index) =>
    isDarkCell(index % QR_GRID_SIZE, Math.floor(index / QR_GRID_SIZE)),
  );
}

const FAKE_QR_CELLS = buildFakeQrCells();

/** Placeholder QR for the authenticator enrolment screen (the real one encodes the otpauth URI). */
export function FakeQrCode() {
  return (
    <div
      role="img"
      aria-label="QR code for your authenticator app"
      className="border-border grid size-[184px] grid-cols-23 rounded-md border bg-white p-2"
    >
      {FAKE_QR_CELLS.map((isDark, index) => (
        <i key={index} className={isDark ? 'bg-ink' : undefined} />
      ))}
    </div>
  );
}
