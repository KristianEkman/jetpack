declare const __GIT_COMMIT_HASH__: string;
declare const __BUILD_DATE_TIME__: string;
declare const io: typeof import("socket.io-client").io;

interface Window {
  io?: typeof import("socket.io-client").io;
  gameInstance?: import("../game.js").Game;
  webkitAudioContext?: typeof AudioContext;
}
