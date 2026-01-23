export class HomeAssistantService {
    private socket: WebSocket | null = null;
    private messageId = 1;
    private handlers: Map<number, (data: any) => void> = new Map();
    private onStateChange: (entities: any[]) => void;
    private connectionTimeout: NodeJS.Timeout | null = null;

    constructor(onStateChange: (entities: any[]) => void) {
        this.onStateChange = onStateChange;
    }

    async connect(baseUrl: string, token: string): Promise<boolean> {
        return new Promise((resolve) => {
            try {
                // Clean and validate URL
                let cleanUrl = baseUrl.trim();

                // Remove trailing slash
                cleanUrl = cleanUrl.replace(/\/$/, '');

                // Ensure it has http or https
                if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
                    cleanUrl = 'http://' + cleanUrl;
                }

                // Create WebSocket URL
                const wsUrl = cleanUrl.replace(/^http/, 'ws').replace(/^https/, 'wss') + '/api/websocket';

                console.log('Connecting to:', wsUrl);

                // Set connection timeout (10 seconds)
                this.connectionTimeout = setTimeout(() => {
                    console.error('HA connection timeout');
                    if (this.socket) {
                        this.socket.close();
                    }
                    resolve(false);
                }, 10000);

                this.socket = new WebSocket(wsUrl);

                this.socket.onopen = () => {
                    console.log("WebSocket opened, waiting for auth_required...");
                };

                this.socket.onmessage = (event) => {
                    const data = JSON.parse(event.data);
                    console.log('HA Message:', data.type);

                    if (data.type === 'auth_required') {
                        console.log('Sending auth token...');
                        this.send({ type: 'auth', access_token: token });
                    } else if (data.type === 'auth_ok') {
                        console.log('✅ HA Auth erfolgreich');
                        if (this.connectionTimeout) {
                            clearTimeout(this.connectionTimeout);
                            this.connectionTimeout = null;
                        }
                        this.subscribeToStates();
                        resolve(true);
                    } else if (data.type === 'auth_invalid') {
                        console.error('❌ HA Auth fehlgeschlagen - Token ungültig');
                        if (this.connectionTimeout) {
                            clearTimeout(this.connectionTimeout);
                            this.connectionTimeout = null;
                        }
                        resolve(false);
                    } else if (data.id && this.handlers.has(data.id)) {
                        this.handlers.get(data.id)!(data);
                    }
                };

                this.socket.onerror = (err) => {
                    console.error("❌ WebSocket Error:", err);
                    if (this.connectionTimeout) {
                        clearTimeout(this.connectionTimeout);
                        this.connectionTimeout = null;
                    }
                    resolve(false);
                };

                this.socket.onclose = (event) => {
                    console.log("WebSocket closed:", event.code, event.reason);
                    if (this.connectionTimeout) {
                        clearTimeout(this.connectionTimeout);
                        this.connectionTimeout = null;
                    }
                };
            } catch (e) {
                console.error("❌ Connection Error:", e);
                if (this.connectionTimeout) {
                    clearTimeout(this.connectionTimeout);
                    this.connectionTimeout = null;
                }
                resolve(false);
            }
        });
    }

    disconnect() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
        if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
        }
        this.handlers.clear();
        this.messageId = 1;
    }

    isConnected(): boolean {
        return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
    }

    private send(data: any, callback?: (data: any) => void) {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            console.warn('Cannot send - WebSocket not open');
            return;
        }
        const id = this.messageId++;
        if (callback) this.handlers.set(id, callback);
        this.socket.send(JSON.stringify({ ...data, id }));
    }

    private subscribeToStates() {
        this.send({ type: 'get_states' }, (response) => {
            if (response.success) {
                console.log(`✅ Loaded ${response.result.length} entities`);
                this.onStateChange(response.result);
            }
        });

        this.send({ type: 'subscribe_events', event_type: 'state_changed' }, (data) => {
            if (data.type === 'event') {
                // Reload all states on any state change
                this.send({ type: 'get_states' }, (res) => {
                    if (res.success) this.onStateChange(res.result);
                });
            }
        });
    }

    async callService(domain: string, service: string, entityId: string, data: any = {}) {
        if (!this.isConnected()) {
            console.error('Cannot call service - not connected to HA');
            return;
        }

        this.send({
            type: 'call_service',
            domain,
            service,
            service_data: { entity_id: entityId, ...data }
        });
    }

    async activateScene(sceneId: string) {
        await this.callService('scene', 'turn_on', sceneId);
    }

    async toggleLight(entityId: string) {
        await this.callService('light', 'toggle', entityId);
    }

    async setLightBrightness(entityId: string, brightness: number) {
        await this.callService('light', 'turn_on', entityId, { brightness });
    }

    async openCover(entityId: string) {
        await this.callService('cover', 'open_cover', entityId);
    }

    async closeCover(entityId: string) {
        await this.callService('cover', 'close_cover', entityId);
    }

    async setCoverPosition(entityId: string, position: number) {
        await this.callService('cover', 'set_cover_position', entityId, { position });
    }

    async startVacuum(entityId: string) {
        await this.callService('vacuum', 'start', entityId);
    }

    async pauseVacuum(entityId: string) {
        await this.callService('vacuum', 'pause', entityId);
    }

    async returnVacuum(entityId: string) {
        await this.callService('vacuum', 'return_to_base', entityId);
    }

    async cleanVacuumRoom(entityId: string, roomId: string) {
        await this.callService('vacuum', 'send_command', entityId, {
            command: 'app_segment_clean',
            params: [parseInt(roomId)]
        });
    }
}
