import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, queryKeys } from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const meQuery = useQuery({
    queryKey: queryKeys.me,
    queryFn: api.me,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Find My House</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Web interface for your French real-estate scraper.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <HomeCard
          title="Search listings"
          description="Filter by city, price, surface, source, compatibility, price drops, map view…"
          to="/listings"
        />
        <HomeCard
          title="Browse"
          description="Review listings one by one with like/dislike."
          to="/browse"
        />
        <HomeCard
          title="Favorites"
          description="Manage your liked listings, archived favorites, and compatibility training."
          to="/favorites"
        />
        <HomeCard
          title="Dislikes"
          description="Review listings you disliked."
          to="/dislikes"
        />
        <HomeCard
          title="Statistics"
          description="Overview, sources, prices, activity and your reactions."
          to="/stats"
        />
        <HomeCard
          title="Help"
          description="Authentication, features, and usage notes."
          to="/help"
        />
        {meQuery.data?.isAdmin ? (
          <HomeCard
            title="Admin"
            description="Run scrape and reconcile manually."
            to="/admin"
          />
        ) : null}
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
        <Link to={to} className={cn(buttonVariants())}>
          Open
        </Link>
      </CardContent>
    </Card>
  );
}
