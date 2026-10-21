// Prints every nickname combination for staff review (T024).
import { allNicknames, NICKNAME_SPACE } from "../src/server/nicknames";

for (const n of allNicknames()) console.log(n);
console.error(`\n${NICKNAME_SPACE} combinations`);
