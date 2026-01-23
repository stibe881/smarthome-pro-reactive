export class HomeAssistantService {
    private socket: WebSocket | null = null;
    private messageId = 1;
    private handlers: Map<number, (data: any) => void> = new Map();
    private onStateChange: (entities: any[]) => void;

    constructor(onStateChange: (entities: any[]) => void) {
        this.onStateChange = onStateChange;
    }

    async connect(baseUrl: string, token: string): Promise<boolean> {
        return new Promise((resolve) => {
            try {
                const wsUrl = baseUrl.replace('http', 'ws').replace(/\/$/, '') + '/api/websocket';
                this.socket = new WebSocket(wsUrl);

                this.socket.onopen = () => console.log("WS Opening...");

                this.socket.onmessage = (event) => {
                    const data = JSON.parse(event.data);

                    if (data.type === 'auth_required') {
                        this.send({ type: 'auth', access_token: token });
                    } else if (data.type === 'auth_ok') {
                        console.log('HA Auth erfolgreich');
                        this.subscribeToStates();
                        resolve(true);
                    } else if (data.type === 'auth_invalid') {
                        console.error('HA Auth fehlgeschlagen');
                        resolve(false);
                    } else if (data.id && this.handlers.has(data.id)) {
                        this.handlers.get(data.id)!(data);
                    }
                };

                this.socket.onerror = (err) => {
                    console.error("WS Error:", err);
                    resolve(false);
                };

                this.socket.onclose = () => {
                    console.log("WS Closed");
                };
            } catch (e) {
                console.error("Connection Error:", e);
                resolve(false);
            }
        });
    }

    private send(data: any, callback?: (data: any) => void) {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
        const id = this.messageId++;
        if (callback) this.handlers.set(id, callback);
        this.socket.send(JSON.stringify({ ...data, id }));
    }

    private subscribeToStates() {
        this.send({ type: 'get_states' }, (response) => {
            if (response.success) {
                this.onStateChange(response.result);
            }
        });

        this.send({ type: 'subscribe_events', event_type: 'state_changed' }, (data) => {
            if (data.type === 'event') {
                this.send({ type: 'get_states' }, (res) => {
                    if (res.success) this.onStateChange(res.result);
                });
            }
        });
    }

    async callService(domain: string, service: string, entityId: string, data: any = {}) {
        this.send({
            type: 'call_service',
            domain,
            service,
            service_data: { entity_id: entityId, ...data }
        });
    }
}
