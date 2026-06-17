import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, queryKeys } from "@/lib/api";
import * as m from "@/paraglide/messages.js";
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
        <h1 className="text-3xl font-semibold">{m.app_name()}</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          {m.home_subtitle()}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <HomeCard
          title={m.home_card_listings_title()}
          description={m.home_card_listings_desc()}
          to="/listings"
        />
        <HomeCard
          title={m.home_card_browse_title()}
          description={m.home_card_browse_desc()}
          to="/browse"
        />
        <HomeCard
          title={m.home_card_favorites_title()}
          description={m.home_card_favorites_desc()}
          to="/favorites"
        />
        <HomeCard
          title={m.home_card_dislikes_title()}
          description={m.home_card_dislikes_desc()}
          to="/dislikes"
        />
        <HomeCard
          title={m.home_card_stats_title()}
          description={m.home_card_stats_desc()}
          to="/stats"
        />
        <HomeCard
          title={m.home_card_help_title()}
          description={m.home_card_help_desc()}
          to="/help"
        />
        {meQuery.data?.isAdmin ? (
          <HomeCard
            title={m.home_card_admin_title()}
            description={m.home_card_admin_desc()}
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
          {m.home_card_open()}
        </Link>
      </CardContent>
    </Card>
  );
}
