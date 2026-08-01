import { io } from 'socket.io-client';
import { httpServer, gameLoop } from '../server/index.js';

const PORT = 3000;

await new Promise((resolve) => httpServer.listen(PORT, resolve));
gameLoop.start();

const socket = io(`http://localhost:${PORT}`);

socket.on('connect', () => {
    console.log('Connected with socket ID:', socket.id);

    socket.emit('create_room', { playerName: 'TestHost', levelIndex: 0 }, (res) => {
        console.log('Create room response:', JSON.stringify(res, null, 2));

        socket.emit('list_rooms', (list) => {
            console.log('List rooms response:', JSON.stringify(list, null, 2));
            socket.disconnect();
            gameLoop.stop();
            httpServer.close(() => {
                process.exit(0);
            });
        });
    });
});

