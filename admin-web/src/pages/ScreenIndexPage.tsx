import { Link } from 'react-router';
import { Card, CardHeader } from '@/components/ui';
import { PageHeader } from '@/components/layout';
import { DESIGN_SCREEN_INDEX } from '@/config/design-screen-index';

/** Design review index: every frame from the static mockups, linked to its live route. */
export function ScreenIndexPage() {
  const total = DESIGN_SCREEN_INDEX.reduce((n, a) => n + a.screens.length, 0);
  return (
    <>
      <PageHeader
        title="Screen index"
        description={`${total} admin frames from docs/design/screens/admin, each linked to its route.`}
      />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
        {DESIGN_SCREEN_INDEX.map((area) => (
          <Card key={area.area}>
            <CardHeader
              title={area.area}
              aside={<code className="text-fg-muted text-xs">{area.source}</code>}
            />
            <ul className="flex flex-col">
              {area.screens.map((s) => (
                <li key={s.id}>
                  <Link to={s.to} className="hover:bg-primary-subtle flex gap-3 rounded-md px-2 py-1.5">
                    <code className="text-fg-muted w-14 shrink-0 font-mono text-xs leading-5">{s.id}</code>
                    <span>{s.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </>
  );
}
