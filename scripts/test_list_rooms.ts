import { io, type Socket } from "socket.io-client";
import { httpServer, gameLoop } from "../server/index.js";
import { ROOM_EVENTS } from "../js/shared/constants.js";

const PORT = 3096;

await new Promise<void>((resolve) => httpServer.listen(PORT, resolve));
gameLoop.start();

const socket: Socket = io(`http://localhost:${PORT}`);

socket.on("connect", () => {
  console.log("Connected with socket ID:", socket.id);

  socket.emit(
    ROOM_EVENTS.CREATE_ROOM,
    { playerName: "TestHost", levelIndex: 0 },
    (res: any) => {
      console.log("Create room response:", JSON.stringify(res, null, 2));

      socket.emit(ROOM_EVENTS.LIST_ROOMS, (list: any) => {
        console.log("List rooms response:", JSON.stringify(list, null, 2));
        socket.disconnect();
        gameLoop.stop();
        httpServer.close(() => {
          process.exit(0);
        });
      });
    },
  );
});
