import { io } from 'socket.io-client';

const socket = io('http://localhost:3000');

socket.on('connect', () => {
    console.log('Connected with socket ID:', socket.id);

    socket.emit('create_room', { playerName: 'TestHost', levelIndex: 0 }, (res) => {
        console.log('Create room response:', JSON.stringify(res, null, 2));

        socket.emit('list_rooms', (list) => {
            console.log('List rooms response:', JSON.stringify(list, null, 2));
            socket.disconnect();
            process.exit(0);
        });
    });
});
