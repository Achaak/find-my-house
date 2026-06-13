import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Find My House</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Web interface for your French real-estate scraper — same features as
          the Discord bot.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <HomeCard
          title="Search listings"
          description="Filter by city, price, surface, source, compatibility…"
          to="/listings"
        />
        <HomeCard
          title="Browse"
          description="Review listings one by one with like/dislike."
          to="/browse"
        />
        <HomeCard
          title="Favorites & dislikes"
          description="Manage your reactions and compatibility training data."
          to="/favorites"
        />
        <HomeCard
          title="Statistics"
          description="Overview, sources, prices, activity and your reactions."
          to="/stats"
        />
      </div>
    </div>
  );
}

function HomeCard({
  title,
  description,
  to,
}: {
  title: string;
  description: string;
  to: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{description}</p>
        <Link to={to}>
          <Button type="button">Open</Button>
        </Link>
      </CardContent>
    </Card>
  );
}
