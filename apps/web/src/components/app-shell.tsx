"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  Languages,
  Crosshair,
  ChevronDown,
  Flame,
  LogOut,
  Menu,
  Settings,
  Swords,
  Trophy,
  UserCircle,
  X,
  Zap,
} from "lucide-react";
import { SessionProvider, signOut, useSession } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { ThemeSwitcher } from "./theme-switcher";
import { AmbientEffects } from "./ambient-effects";
import { PageEffects } from "./page-effects";
import { PreferenceSync } from "./preference-sync";
import { InterfaceEffects } from "./interface-effects";
import { GeminiChatWidget } from "./gemini-chat-widget";
import { GlobalSearch } from "./global-search";
import { games } from "@clutchverse/core";
import { languageOptions, type Locale } from "@/i18n/locales";
import { LocaleProvider, useLocale } from "@/i18n/locale-context";

const links = [
  ["Tournaments", "/tournaments"],
  ["Rankings", "/rankings"],
  ["Season play", "/seasonal-play"],
  ["Live", "/live"],
  ["Community", "/community"],
  ["About Us", "/about"],
  ["Contact Us", "/contact"],
  ["FAQ", "/faq"],
] as const;

export function AppShell({
  children,
  initialLocale,
}: {
  children: ReactNode;
  initialLocale: Locale;
}) {
  return (
    <ThemeProvider
      attribute="data-theme"
      defaultTheme="neon-cyber"
      themes={[
        "neon-cyber",
        "crimson-war",
        "toxic-venom",
        "arctic-frost",
        "royal-gold",
        "light-pro",
      ]}
      enableSystem={false}
      storageKey="clutchverse-theme"
      disableTransitionOnChange
    >
      <SessionProvider>
        <LocaleProvider initialLocale={initialLocale}>
          <AppShellContent>{children}</AppShellContent>
        </LocaleProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}

function AppShellContent({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [gameMenuOpen, setGameMenuOpen] = useState(false);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const languageMenuRef = useRef<HTMLDivElement>(null);
  const { locale, setLocale, messages } = useLocale();
  const pathname = usePathname();
  useEffect(() => {
    setMenuOpen(false);
    setGameMenuOpen(false);
    setLanguageMenuOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator)
    )
      return;
    void navigator.serviceWorker.register("/sw.js").catch((error: unknown) => {
      console.error("Service worker registration failed.", error);
    });
  }, []);
  useEffect(() => {
    if (!languageMenuOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !languageMenuRef.current?.contains(event.target)
      )
        setLanguageMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLanguageMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [languageMenuOpen]);

  return (
    <>
      <PreferenceSync />
      <AmbientEffects />
      <PageEffects />
      <InterfaceEffects />
      <GeminiChatWidget />
      <header className="site-header">
        <div className="container header-inner">
          <Link className="brand" href="/" aria-label="ClutchVerse home">
            <span className="brand-mark">
              C<span>V</span>
            </span>
            <span className="brand-name">
              CLUTCH<span>VERSE</span>
            </span>
          </Link>
          <nav
            className={`main-nav ${menuOpen ? "nav-open" : ""}`}
            aria-label={messages.account.mainNavigation}
          >
            <div className="nav-game-menu">
              <button
                type="button"
                className={
                  pathname.startsWith("/games")
                    ? "nav-link nav-active"
                    : "nav-link"
                }
                aria-haspopup="menu"
                aria-expanded={gameMenuOpen}
                onClick={() => setGameMenuOpen((open) => !open)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setGameMenuOpen(false);
                }}
              >
                {messages.nav.games} <ChevronDown size={12} />
              </button>
              {gameMenuOpen && (
                <div
                  className="nav-game-dropdown panel"
                  role="menu"
                  aria-label={messages.account.chooseGame}
                >
                  {games.map((game) => {
                    const Icon =
                      game.slug === "pubg-mobile"
                        ? Crosshair
                        : game.slug === "free-fire"
                          ? Flame
                          : game.slug === "tekken-8"
                            ? Swords
                            : Trophy;
                    return (
                      <Link
                        key={game.slug}
                        href={`/games/${game.slug}`}
                        className="nav-game-option"
                        role="menuitem"
                        style={
                          { "--game-accent": game.accent } as CSSProperties
                        }
                        onClick={() => setGameMenuOpen(false)}
                      >
                        <Icon size={17} />
                        <span>
                          <strong>{game.name}</strong>
                          <small>{game.tag}</small>
                        </span>
                      </Link>
                    );
                  })}
                  <Link
                    href="/games"
                    className="nav-game-overview"
                    role="menuitem"
                  >
                    {messages.nav.allGames} <ChevronDown size={12} />
                  </Link>
                </div>
              )}
            </div>
            {links.map(([label, href]) => (
              <Link
                className={
                  pathname === href || pathname.startsWith(`${href}/`)
                    ? "nav-link nav-active"
                    : "nav-link"
                }
                href={href}
                key={href}
              >
                {label === "Tournaments"
                  ? messages.nav.tournaments
                  : label === "Rankings"
                    ? messages.nav.rankings
                    : label === "Season play"
                      ? messages.nav.seasonPass
                    : label === "Live"
                      ? messages.nav.live
                      : label === "Community"
                        ? messages.nav.community
                        : label === "About Us"
                          ? messages.nav.about
                          : label === "Contact Us"
                            ? messages.nav.contact
                            : messages.nav.faq}
              </Link>
            ))}
          </nav>
          <div className="header-actions">
            <GlobalSearch />
            <ThemeSwitcher />
            <div className="language-menu" ref={languageMenuRef}>
              <button
                className="locale-toggle"
                type="button"
                aria-label={messages.language}
                aria-haspopup="menu"
                aria-expanded={languageMenuOpen}
                onClick={() => setLanguageMenuOpen((open) => !open)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setLanguageMenuOpen(false);
                }}
              >
                <Languages size={15} />
                <span>{messages.language}</span>
                <ChevronDown size={12} />
              </button>
              {languageMenuOpen && (
                <div
                  className="language-dropdown panel"
                  role="menu"
                  aria-label={messages.language}
                >
                  {languageOptions.map((option) => (
                    <button
                      className="language-option"
                      type="button"
                      key={option.code}
                      role="menuitemradio"
                      aria-checked={locale === option.code}
                      lang={option.code}
                      dir={
                        option.code === "ur" || option.code === "ar"
                          ? "rtl"
                          : "ltr"
                      }
                      onClick={() => {
                        setLocale(option.code);
                        setLanguageMenuOpen(false);
                      }}
                    >
                      <span>{option.nativeName}</span>
                      <small>{option.name}</small>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <AccountActions />
            <button
              className="icon-button menu-button"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>
      <main className="page-transition" key={pathname}>
        {children}
      </main>
      <footer className="site-footer">
        <div className="container footer-main">
          <div className="footer-brand">
            <Link className="brand" href="/">
              <span className="brand-mark">
                C<span>V</span>
              </span>
              <span className="brand-name">
                CLUTCH<span>VERSE</span>
              </span>
            </Link>
            <p className="muted">{messages.footer.tagline}</p>
          </div>
          <div className="footer-links">
            <div>
              <strong>{messages.footer.arena}</strong>
              <Link href="/games">{messages.nav.games}</Link>
              <Link href="/tournaments">{messages.nav.tournaments}</Link>
              <Link href="/rankings">{messages.nav.rankings}</Link>
            </div>
            <div>
              <strong>{messages.footer.community}</strong>
              <Link href="/live">{messages.footer.live}</Link>
              <Link href="/community">{messages.footer.chat}</Link>
              <Link href="/teams">{messages.footer.teams}</Link>
            </div>
            <div>
              <strong>{messages.footer.brand}</strong>
              <Link href="/about">{messages.footer.about}</Link>
              <Link href="/fair-play">{messages.footer.fairPlay}</Link>
              <Link href="/contact">{messages.footer.contact}</Link>
              <Link href="/faq">{messages.footer.faq}</Link>
            </div>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>{messages.footer.copyright}</span>
          <span>{messages.footer.legal}</span>
        </div>
      </footer>
    </>
  );
}

function AccountActions() {
  const { data, status } = useSession();
  const { messages } = useLocale();
  if (status === "loading") return null;
  if (!data?.user)
    return (
      <>
        <Link className="signin-link" href="/login">
          {messages.account.signIn}
        </Link>
        <Link className="button button-primary header-join" href="/register">
          <Zap size={13} /> {messages.account.join}
        </Link>
      </>
    );
  return (
    <div className="account-actions">
      <Link
        className="account-link"
        href="/settings"
        aria-label={messages.account.account}
      >
        <UserCircle size={16} />
        <span>{messages.account.account}</span>
      </Link>
      {data.user.role === "organizer" && (
        <Link
          className="account-link"
          href="/organizer"
          aria-label="Organizer dashboard"
        >
          <Settings size={15} />
        </Link>
      )}
      {data.user.role === "admin" && (
        <Link
          className="account-link"
          href="/admin"
          aria-label="Admin dashboard"
        >
          <Settings size={15} />
        </Link>
      )}
      <button
        className="icon-button signout-button"
        aria-label={messages.account.signOut}
        onClick={() => void signOut({ callbackUrl: "/" })}
      >
        <LogOut size={15} />
      </button>
    </div>
  );
}
