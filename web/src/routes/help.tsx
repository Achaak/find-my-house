import { createFileRoute, Link } from "@tanstack/react-router";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import * as m from "@/paraglide/messages.js";
import { cn } from "@/lib/utils";

const journeys = [
  {
    title: () => m.help_journey_search_title(),
    description: () => m.help_journey_search_desc(),
    to: "/listings" as const,
    action: () => m.home_go_listings(),
  },
  {
    title: () => m.help_journey_browse_title(),
    description: () => m.help_journey_browse_desc(),
    to: "/browse" as const,
    action: () => m.home_start_browse(),
  },
  {
    title: () => m.help_journey_reactions_title(),
    description: () => m.help_journey_reactions_desc(),
    to: "/favorites" as const,
    action: () => m.home_view_all_favorites(),
  },
  {
    title: () => m.help_journey_detail_title(),
    description: () => m.help_journey_detail_desc(),
    to: "/listings" as const,
    action: () => m.help_journey_detail_action(),
  },
  {
    title: () => m.help_journey_stats_title(),
    description: () => m.help_journey_stats_desc(),
    to: "/stats" as const,
    action: () => m.home_go_stats(),
  },
] as const;

export const Route = createFileRoute("/help")({
  component: HelpPage,
});

function HelpPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{m.help_title()}</h1>
        <p className="text-sm text-muted-foreground">{m.help_subtitle()}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {journeys.map((journey) => (
          <Card key={journey.title()}>
            <CardHeader>
              <CardTitle className="text-base">{journey.title()}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {journey.description()}
              </p>
              <Link
                to={journey.to}
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" })
                )}
              >
                {journey.action()}
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{m.help_more_title()}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>{m.help_feature_admin()}</p>
          <p>{m.help_feature_notifications()}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{m.help_auth_title()}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>{m.help_auth_body()}</p>
          <p>{m.help_auth_user()}</p>
        </CardContent>
      </Card>

      <Link to="/" className={cn(buttonVariants({ variant: "outline" }))}>
        {m.help_back_home()}
      </Link>
    </div>
  );
}
