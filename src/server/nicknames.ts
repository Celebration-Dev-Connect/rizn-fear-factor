// Curated, kid-safe nickname parts (FR-002). Reviewed by RIZN staff before the event:
// run `npm run check:nicknames` to print every combination.
export const ADJECTIVES = [
  "Midnight", "Shadow", "Haunted", "Spooky", "Creepy", "Moonlit", "Misty", "Starlit",
  "Ghostly", "Wicked", "Eerie", "Frosty", "Howling", "Whispering", "Grinning", "Cackling",
  "Crimson", "Velvet", "Silver", "Harvest", "Candlelit", "Foggy", "Rattling", "Creaky",
  "Shivering", "Lurking", "Sneaky", "Glowing", "Twilight", "Starless", "Cobweb", "Bat-Winged",
  "Mossy", "Thunder", "Inky", "Lantern", "Clockwork", "Moonbeam", "Spectral", "Witching",
] as const;

export const NOUNS = [
  "Gremlin", "Ghoul", "Goblin", "Phantom", "Specter", "Wraith", "Banshee", "Zombie",
  "Mummy", "Werewolf", "Vampire", "Skeleton", "Pumpkin", "Raven", "Bat", "Spider",
  "Owl", "Cat", "Wizard", "Witch", "Warlock", "Gargoyle", "Scarecrow", "Jack-o'-Lantern",
  "Poltergeist", "Shade", "Imp", "Troll", "Yeti", "Kraken", "Golem", "Sasquatch",
  "Cyclops", "Hydra", "Basilisk", "Banshee Bard", "Night Owl", "Moth", "Toad", "Wisp",
] as const;

export const NICKNAME_SPACE = ADJECTIVES.length * NOUNS.length;

export function nicknameAt(index: number): string {
  const a = ADJECTIVES[Math.floor(index / NOUNS.length) % ADJECTIVES.length]!;
  const n = NOUNS[index % NOUNS.length]!;
  return `${a} ${n}`;
}

export function allNicknames(): string[] {
  return Array.from({ length: NICKNAME_SPACE }, (_, i) => nicknameAt(i));
}
