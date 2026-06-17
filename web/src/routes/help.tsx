import { createFileRoute, Link } from "@tanstack/react-router";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import * as m from "@/paraglide/messages.js";
import { cn } from "@/lib/utils";

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

      <Card>
        <CardHeader>
          <CardTitle>{m.help_features_title()}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>{m.help_feature_listings()}</p>
          <p>{m.help_feature_browse()}</p>
          <p>{m.help_feature_reactions()}</p>
          <p>{m.help_feature_detail()}</p>
          <p>{m.help_feature_stats()}</p>
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
