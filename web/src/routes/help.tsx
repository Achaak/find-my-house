import { createFileRoute, Link } from "@tanstack/react-router";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/help")({
  component: HelpPage,
});

function HelpPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Help</h1>
        <p className="text-sm text-muted-foreground">
          How to use the Find My House web app.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Features</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">Listings</strong> — Search the
            database with city, postal code, text, source, price, surface, land,
            rooms, bedrooms, old/new build, travel time, price drops, and sort
            options.
          </p>
          <p>
            <strong className="text-foreground">Browse</strong> — Review
            listings one at a time with like/dislike, sorted by compatibility
            when you have enough training data.
          </p>
          <p>
            <strong className="text-foreground">Favorites & dislikes</strong> —
            Manage reactions, archive favorites, and train compatibility
            scoring.
          </p>
          <p>
            <strong className="text-foreground">Listing detail</strong> — Full
            property info, publication links, and ADEME DPE address
            confirmation.
          </p>
          <p>
            <strong className="text-foreground">Statistics</strong> — Overview,
            sources, prices, your reactions, and scraping activity.
          </p>
          <p>
            <strong className="text-foreground">Admin</strong> — Manual scrape
            and reconcile (admin users only).
          </p>
          <p>
            <strong className="text-foreground">Notifications</strong> — Enable
            browser notifications in the header to get alerts for new listings
            and price drops.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Authentication</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Open this app from Home Assistant Ingress, or paste a long-lived
            access token on the login screen for local development.
          </p>
          <p>
            Reactions are tied to your Home Assistant user (
            <code>ha:username</code>).
          </p>
        </CardContent>
      </Card>

      <Link to="/" className={cn(buttonVariants({ variant: "outline" }))}>
        Back to home
      </Link>
    </div>
  );
}
