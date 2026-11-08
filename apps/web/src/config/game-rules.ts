import type { GameSlug } from "@clutchverse/core";

export type GameRules = {
  genre: string;
  platforms: string;
  modes: string[];
  activeRegions: string[];
  squadSize: number;
  eligibility: string;
  deviceRules: string;
  fairPlay: string;
  antiCheat: string;
  scoring: string;
  disputes: string;
  prizes: string;
  faqs: { question: string; answer: string }[];
};

export const gameRules: Record<GameSlug, GameRules> = {
  "pubg-mobile": {
    genre: "Battle royale",
    platforms: "Android and iOS mobile devices",
    modes: ["Solo", "Duo", "Squad"],
    activeRegions: ["South Asia", "Southeast Asia", "MENA", "Europe"],
    squadSize: 4,
    eligibility:
      "Players must meet the legal age requirement for their location and provide the same in-game ID used at check-in.",
    deviceRules:
      "Mobile devices only unless an event explicitly allows an approved accessibility setup. Emulators and unauthorized input tools are not allowed.",
    fairPlay:
      "No teaming between opposing squads, account sharing, match manipulation, or harassment. Captains must confirm their roster before check-in.",
    antiCheat:
      "Organizers may request a live screen recording or match evidence when a result is challenged. Suspected cheating is reviewed before a result is finalized.",
    scoring:
      "Battle-royale events use the event's published placement and elimination points table. A tie is broken by placement points, then best match placement.",
    disputes:
      "Submit a dispute with match ID and evidence within the event's published reporting window; an organizer reviews both sides before resolution.",
    prizes:
      "Prize eligibility, split, and delivery schedule are shown on each event page. Identity checks may be required before withdrawal.",
    faqs: [
      {
        question: "Can I register without a team?",
        answer:
          "Yes. Choose Solo or Duo where enabled; Squad events require a complete roster by the check-in deadline.",
      },
      {
        question: "Which game ID should I enter?",
        answer:
          "Use the PUBG MOBILE character ID shown on your in-game profile. The same account must be used throughout the event.",
      },
      {
        question: "How are points awarded?",
        answer:
          "Each event publishes its placement and elimination scoring before registration closes.",
      },
    ],
  },
  "free-fire": {
    genre: "Battle royale",
    platforms: "Android and iOS mobile devices",
    modes: ["Solo", "Duo", "Squad"],
    activeRegions: ["South Asia", "Southeast Asia", "MENA", "Latin America"],
    squadSize: 4,
    eligibility:
      "Players must meet the legal age requirement for their location and use a reachable Free Fire UID on the registered account.",
    deviceRules:
      "Use a supported mobile device and permitted controls. Emulators, macros, modified clients, and unauthorized overlays are prohibited unless an event explicitly states otherwise.",
    fairPlay:
      "No collusion, account sharing, intentional disconnects, or abuse. Registered squad members may not be replaced after the event lock without organizer approval.",
    antiCheat:
      "Organizers can request match recordings and review unusual play patterns. A report alone is not proof; outcomes require evidence and a review.",
    scoring:
      "Points combine placement and eliminations using the event's published table. Ties are settled by wins, then total eliminations.",
    disputes:
      "Report a score issue with the lobby and match reference before the event's dispute deadline; both captains may submit evidence.",
    prizes:
      "The event page defines payout amounts and deadlines. A verified recipient may be required for cash prizes.",
    faqs: [
      {
        question: "Are mixed-region squads allowed?",
        answer:
          "Only when the event lists Global or permits mixed regions; the tournament region filter is authoritative.",
      },
      {
        question: "What happens if a player disconnects?",
        answer:
          "The match continues unless an organizer pauses it under the published event rules.",
      },
      {
        question: "Can I change my UID?",
        answer:
          "Ask the organizer before roster lock. Unapproved account changes can invalidate match results.",
      },
    ],
  },
  "tekken-8": {
    genre: "Fighting",
    platforms: "PlayStation 5, Xbox Series X|S, and PC where enabled",
    modes: ["Solo"],
    activeRegions: ["South Asia", "East Asia", "Europe", "North America"],
    squadSize: 1,
    eligibility:
      "Competitors must meet the legal age requirement for their location and register the platform ID they will use in the bracket.",
    deviceRules:
      "Use the platform and online region listed by the organizer. Approved accessibility controllers are allowed; macros and gameplay automation are not.",
    fairPlay:
      "No match fixing, deliberate disconnects, or abusive behavior. Players must be ready in the assigned lobby at match time.",
    antiCheat:
      "Suspected automation or modified clients are reviewed using match evidence and organizer logs before a sanction is issued.",
    scoring:
      "Matches use the event's published round and game count. Confirmed wins update the platform rating; ties require a replay unless the organizer records a forfeit.",
    disputes:
      "Pause only when permitted by event rules. File a dispute with the set and round details before leaving the lobby.",
    prizes:
      "Placements and prize splits are published before registration closes; identity verification may be required for cash payouts.",
    faqs: [
      {
        question: "Which platform ID should I provide?",
        answer:
          "Use the PSN, Xbox, or Steam ID selected for that tournament and keep it consistent through the bracket.",
      },
      {
        question: "Are alternate controllers allowed?",
        answer:
          "Accessibility controllers are permitted when they do not automate gameplay; organizers can clarify device questions before check-in.",
      },
      {
        question: "How is a disputed set resolved?",
        answer:
          "The organizer reviews both players' evidence and records a final ruling in the match history.",
      },
    ],
  },
  fifa: {
    genre: "Football simulation",
    platforms: "PlayStation 5, Xbox Series X|S, and PC where enabled",
    modes: ["Solo"],
    activeRegions: ["South Asia", "MENA", "Europe", "North America"],
    squadSize: 1,
    eligibility:
      "Competitors must meet the legal age requirement for their location and use the EA/platform ID registered for the event.",
    deviceRules:
      "Use the edition, platform, match settings, and online region specified by the organizer. Unauthorized automation or modified clients are prohibited.",
    fairPlay:
      "No match manipulation, account sharing, intentional disconnects, or abusive conduct. Players should capture the final score before leaving the match.",
    antiCheat:
      "Organizers may review score evidence and platform match records. Repeated suspicious results are escalated for a documented review.",
    scoring:
      "The event defines match length, extra time, penalties, and tie-breakers. Confirmed results affect the competitive rating.",
    disputes:
      "Report a score or connection issue with both player IDs and available match evidence before the event deadline.",
    prizes:
      "Prize placements, split, and delivery schedule are listed on the event page; cash withdrawals may require identity checks.",
    faqs: [
      {
        question: "Which EA ID do I register?",
        answer:
          "Register the EA account linked to the platform you will use, and confirm it with your opponent at check-in.",
      },
      {
        question: "Can I enter on a different platform?",
        answer: "Only if the tournament's platform rules explicitly allow it.",
      },
      {
        question: "What if the connection drops?",
        answer:
          "Record the score and contact the organizer immediately; replay decisions follow that event's published rules.",
      },
    ],
  },
};
