export class HomeAssistantService {
    private socket: WebSocket | null = null;
    private messageId = 1;
    private handlers: Map<number, (data: any) => void> = new Map();
    private onStateChange: (entities: any[]) => void;
    private connectionTimeout: ReturnType<typeof setTimeout> | null = null;

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
                    // In React Native, event.data is string
                    const data = JSON.parse(event.data as string);
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

        // Special handling for auth message - NO ID ALLOWED per HA WebSocket API spec
        if (data.type === 'auth') {
            console.log('Sending auth without ID (as per HA spec)');
            this.socket.send(JSON.stringify(data));
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

    async fetchCalendarEvents(entityId: string, start: string, end: string): Promise<any[]> {
        console.log(`fetching calendar events for ${entityId} from ${start} to ${end}`);
        return new Promise((resolve) => {
            if (!this.isConnected()) {
                console.warn('Cannot fetch events - not connected');
                resolve([]);
                return;
            }

            this.send({
                type: 'call_service',
                domain: 'calendar',
                service: 'get_events',
                service_data: {
                    entity_id: entityId,
                    start_date_time: start,
                    end_date_time: end
                },
                return_response: true
            }, (response) => {
                console.log('Calendar Raw Response:', JSON.stringify(response));

                if (response.success && response.result) {
                    let targetData = response.result;

                    // Handle nested response object (common in service calls with return_response: true)
                    if (targetData.response) {
                        targetData = targetData.response;
                    }

                    // Try exact match in target data
                    if (targetData[entityId] && targetData[entityId].events) {
                        const events = targetData[entityId].events;
                        console.log(`Found ${events.length} events (exact match)`);
                        resolve(events);
                        return;
                    }

                    // Try loose match (check any key in target data)
                    const keys = Object.keys(targetData);
                    if (keys.length > 0) {
                        const firstKey = keys[0];
                        if (targetData[firstKey] && targetData[firstKey].events) {
                            console.log(`Found events under key: ${firstKey}`);
                            resolve(targetData[firstKey].events);
                            return;
                        }

                        // Debug: Keys found but no events property
                        const emptyArr: any[] = [];
                        (emptyArr as any)._debug = `Keys: ${keys.join(', ')} | FirstVal: ${JSON.stringify(targetData[firstKey]).substring(0, 50)}`;
                        resolve(emptyArr);
                        return;
                    }

                    console.warn('Structure mismatch. Keys found:', keys);
                    const emptyArr: any[] = [];
                    (emptyArr as any)._debug = `No keys in result. Raw: ${JSON.stringify(response).substring(0, 50)}`;
                    resolve(emptyArr);
                    return;
                } else {
                    console.warn('Call failed or no result', response);
                    const emptyArr: any[] = [];
                    (emptyArr as any)._debug = `Success: ${response.success} | Result: ${JSON.stringify(response.result)}`;
                    resolve(emptyArr);
                }
            });
        });
    }
    async browseMedia(entityId: string, mediaContentId?: string, mediaContentType?: string): Promise<any> {
        if (!this.isConnected()) return null;

        console.log(`🔍 Browsing Media for ${entityId}`, { mediaContentId, mediaContentType });

        return new Promise((resolve) => {
            this.send({
                type: 'call_service',
                domain: 'media_player',
                service: 'browse_media',
                service_data: {
                    entity_id: entityId,
                    media_content_id: mediaContentId,
                    media_content_type: mediaContentType
                },
                return_response: true
            }, (response) => {
                console.log('📦 Browse Response:', JSON.stringify(response, null, 2));

                if (response.success && response.result) {
                    let result = response.result;
                    // Handle nested response format (service call with return_response: true)
                    if (result.response) {
                        // Check for exact entity match
                        if (result.response[entityId]) {
                            result = result.response[entityId];
                        }
                        // Fallback: If returned structure has keys, take the first one 
                        else if (typeof result.response === 'object') {
                            const keys = Object.keys(result.response);
                            if (keys.length > 0) {
                                result = result.response[keys[0]];
                            }
                        }
                    }

                    console.log(`✅ Found ${result.children?.length || 0} items for ${result.title}`);
                    resolve(result);
                } else {
                    console.warn('❌ Browse media failed or empty', response);
                    resolve(null);
                }
            });
        });
    }

    async playMedia(entityId: string, mediaContentId: string, mediaContentType: string) {
        console.log('📺 playMedia called:', { entityId, mediaContentId, mediaContentType });

        return new Promise<void>((resolve, reject) => {
            const id = this.messageId++;

            const payload = {
                id,
                type: 'call_service',
                domain: 'media_player',
                service: 'play_media',
                service_data: {
                    entity_id: entityId,
                    media_content_id: mediaContentId,
                    media_content_type: mediaContentType
                }
            };

            console.log('📤 Sending play_media command:', JSON.stringify(payload, null, 2));

            this.handlers.set(id, (response: any) => {
                console.log('📥 play_media response:', response);
                if (response.success) {
                    console.log('✅ Play command accepted by HA');
                    resolve();
                } else {
                    console.error('❌ Play command rejected:', response.error);
                    reject(new Error(response.error?.message || 'Unknown error'));
                }
            });

            this.socket!.send(JSON.stringify(payload));
        });
    }

    async spotcastStart(spotifyUri: string, deviceName: string) {
        console.log('🎵 spotcastStart called:', { spotifyUri, deviceName });

        return new Promise<void>((resolve, reject) => {
            const id = this.messageId++;

            const payload = {
                id,
                type: 'call_service',
                domain: 'spotcast',
                service: 'start',
                service_data: {
                    uri: spotifyUri,
                    device_name: deviceName,
                    random_song: false,
                    shuffle: false
                }
            };

            console.log('📤 Sending spotcast.start command:', JSON.stringify(payload, null, 2));

            this.handlers.set(id, (response: any) => {
                console.log('📥 spotcast.start response:', response);
                if (response.success) {
                    console.log('✅ Spotcast command accepted by HA');
                    resolve();
                } else {
                    console.error('❌ Spotcast command rejected:', response.error);
                    reject(new Error(response.error?.message || 'Unknown error'));
                }
            });

            this.socket!.send(JSON.stringify(payload));
        });
    }
}
