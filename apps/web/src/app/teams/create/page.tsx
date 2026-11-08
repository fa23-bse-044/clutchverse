import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { TeamCreateForm } from "@/components/team-create-form";

export const metadata = { title: "Create a team" };

export default async function CreateTeamPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/teams/create");
  return <section className="section auth-page"><div className="auth-card panel"><div className="eyebrow">BUILD YOUR ROSTER</div><h1>Create a team.</h1><p className="muted">Pick your game and give your squad a name. You’ll be the captain.</p><TeamCreateForm /></div></section>;
}
