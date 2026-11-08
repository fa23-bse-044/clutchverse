export type FaqCategory =
  | "account"
  | "tournaments"
  | "payments"
  | "streaming"
  | "fairPlay"
  | "technical";

export type MessageCatalog = {
  language: string;
  account: {
    signIn: string;
    join: string;
    account: string;
    signOut: string;
    search: string;
    mainNavigation: string;
    chooseGame: string;
  };
  nav: {
    games: string;
    allGames: string;
    tournaments: string;
    rankings: string;
    live: string;
    community: string;
    about: string;
    contact: string;
    faq: string;
  };
  footer: {
    tagline: string;
    arena: string;
    community: string;
    brand: string;
    live: string;
    chat: string;
    teams: string;
    about: string;
    fairPlay: string;
    contact: string;
    faq: string;
    copyright: string;
    legal: string;
  };
  faq: {
    title: string;
    intro: string;
    search: string;
    all: string;
    empty: string;
    categories: Record<FaqCategory, string>;
    questions: ReadonlyArray<readonly [FaqCategory, string, string]>;
  };
  chat: {
    title: string;
    subtitle: string;
    close: string;
    loading: string;
    signInPrompt: string;
    signIn: string;
    history: string;
    newConversation: string;
    deleteConversation: string;
    empty: string;
    ask: string;
    placeholder: string;
    send: string;
    you: string;
  };
  proScene: {
    title: string;
    intro: string;
    events: string;
    all: string;
    live: string;
    upcoming: string;
    completed: string;
    noData: string;
    adminFallback: string;
    dateUnavailable: string;
    prize: string;
    source: string;
    updated: string;
    attribution: string;
    addEvent: string;
    game: string;
    name: string;
    status: string;
    startsAt: string;
    endsAt: string;
    region: string;
    stage: string;
    format: string;
    sourceName: string;
    sourceUrl: string;
    license: string;
    save: string;
    saved: string;
    saveError: string;
    loading: string;
    delete: string;
    standings: string;
    participatingTeams: string;
    results: string;
    unknownEntrant: string;
    noResults: string;
    teams: string;
    players: string;
    roster: string;
    history: string;
    titles: string;
    recentResults: string;
    role: string;
    bestPlacement: string;
  };
};
