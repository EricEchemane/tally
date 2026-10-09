from fastapi import APIRouter, WebSocket, WebSocketDisconnect

import events

router = APIRouter()


@router.websocket("/ws")
async def ws(socket: WebSocket):
    await events.connect(socket)
    try:
        while True:
            await socket.receive_text()  # clients don't send; this just keeps the socket open
    except WebSocketDisconnect:
        events.disconnect(socket)
