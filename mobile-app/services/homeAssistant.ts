export class HomeAssistantService {
    private socket: WebSocket | null = null;
    private messageId = 1;
    private handlers: Map<number, (data: any) => void> = new Map();
    private onStateChange: (entities: any[]) => void;
    private credentials: { url: string; token: string } | null = null;
    private shouldReconnect = false;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private onConnectionChange: ((isConnected: boolean) => void) | null = null;
    private connectionTimeout: ReturnType<typeof setTimeout> | null = null;
    private pingInterval: ReturnType<typeof setInterval> | null = null;

    constructor(onStateChange: (entities: any[]) => void) {
        this.onStateChange = onStateChange;
    }

    setConnectionCallback(callback: (isConnected: boolean) => void) {
        this.onConnectionChange = callback;
    }

    // Ping logic to keep connection alive
    private startPingInterval() {
        if (this.pingInterval) clearInterval(this.pingInterval);
        
        // Ping every 10 seconds (Aggressive Keep-Alive)
        this.pingInterval = setInterval(() => {
            if (this.isConnected()) {
                const id = this.messageId++;
                // console.log(`Sending PING (id: ${id})`);
                this.socket?.send(JSON.stringify({ id, type: 'ping' }));
            }
        }, 10000);
    }

    private stopPingInterval() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    async connect(baseUrl: string, token: string): Promise<boolean> {
        this.stopPingInterval();
        
        // ... (rest of connect)
        // Clear any pending reconnect
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        this.credentials = { url: baseUrl, token };
        this.shouldReconnect = true;

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

                 // console.log('Connecting to:', wsUrl);

                // Set connection timeout (30 seconds)
                this.token = token;
                this.connectionTimeout = setTimeout(() => {
                    console.log('⚠️ HA connection timeout (auto-retry)');
                    if (this.socket) {
                        this.socket.close();
                    }
                    resolve(false);
                }, 30000);

                if (this.socket) {
                    // Close existing socket cleanly before new one
                    try { this.socket.close(); } catch(e) {}
                }

                this.socket = new WebSocket(wsUrl);

                this.socket.onopen = () => {
                   // console.log("WebSocket opened, waiting for auth_required...");
                };

                this.socket.onmessage = (event) => {
                    // In React Native, event.data is string
                    const data = JSON.parse(event.data as string);
                    // console.log('HA Message:', data.type);

                    if (data.type === 'auth_required') {
                        // console.log('Sending auth token...');
                        this.send({ type: 'auth', access_token: token });
                    } else if (data.type === 'auth_ok') {
                         // console.log('✅ HA Auth erfolgreich (Version: ' + data.ha_version + ')');
                        if (this.connectionTimeout) {
                            clearTimeout(this.connectionTimeout);
                            this.connectionTimeout = null;
                        }
                        this.startPingInterval();
                        this.subscribeToStates();
                        if (this.onConnectionChange) this.onConnectionChange(true);
                        resolve(true);
                    } else if (data.type === 'auth_invalid') {
                        console.error('❌ HA Auth fehlgeschlagen - Token ungültig');
                        this.shouldReconnect = false; // Stop reconnecting if auth is bad
                        if (this.connectionTimeout) {
                            clearTimeout(this.connectionTimeout);
                            this.connectionTimeout = null;
                        }
                        if (this.onConnectionChange) this.onConnectionChange(false);
                        resolve(false);
                    } else if (data.id && this.handlers.has(data.id)) {
                        this.handlers.get(data.id)!(data);
                    }
                };

                this.socket.onerror = (err) => {
                    console.log("⚠️ WebSocket Connection warning:", err); 
                    if (this.connectionTimeout) {
                        clearTimeout(this.connectionTimeout);
                        this.connectionTimeout = null;
                    }
                    // Don't resolve(false) here immediately, wait for close
                };

                this.socket.onclose = (event) => {
                    // console.log("WebSocket closed:", event.code, event.reason);
                    this.stopPingInterval();
                    if (this.connectionTimeout) {
                        clearTimeout(this.connectionTimeout);
                        this.connectionTimeout = null;
                    }
                    
                    if (this.onConnectionChange) this.onConnectionChange(false);

                    if (this.shouldReconnect && this.credentials) {
                        // console.log("🔄 Auto-Reconnecting in 5s...");
                        this.reconnectTimer = setTimeout(() => {
                            if (this.shouldReconnect && this.credentials) {
                                this.connect(this.credentials.url, this.credentials.token);
                            }
                        }, 5000);
                    }
                    
                    // Only resolve false if we are in the initial connection phase
                    // If we were already connected, this promise effectively does nothing (it was already resolved)
                    resolve(false); 
                };
            } catch (e) {
                console.log("⚠️ Connection Setup Warning:", e);
                if (this.connectionTimeout) {
                    clearTimeout(this.connectionTimeout);
                    this.connectionTimeout = null;
                }
                resolve(false);
            }
        });
    }

    disconnect() {
        this.shouldReconnect = false;
        this.stopPingInterval();
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
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
        if (this.onConnectionChange) this.onConnectionChange(false);
    }

    isConnected(): boolean {
        return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
    }

    private send(data: any, callback?: (data: any) => void) {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            // console.debug('Cannot send - WebSocket not open'); // Silencing noise
            return;
        }

        // Special handling for auth message - NO ID ALLOWED per HA WebSocket API spec
        if (data.type === 'auth') {
            // console.log('Sending auth without ID (as per HA spec)');
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
                // console.log(`✅ Loaded ${response.result.length} entities`);
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

        // Subscribe to all events for specific event handling (e.g., doorbell)
        this.send({ type: 'subscribe_events' }, (data) => {
            if (data.type === 'event' && this.onEventCallback) {
                this.onEventCallback(data.event);
            }
        });
    }

    public token: string | null = null;
    private onEventCallback: ((event: any) => void) | null = null;

    setEventCallback(callback: (event: any) => void) {
        this.onEventCallback = callback;
    }

    callService(domain: string, service: string, entityId: string, data: any = {}): Promise<any> {
        if (!this.isConnected()) {
            // console.warn('Cannot call service - not connected to HA');
            return Promise.reject(new Error('Not connected'));
        }

        // console.log(`📤 Calling service: ${domain}.${service} for ${entityId}`, data);

        return new Promise((resolve, reject) => {
            this.send({
                type: 'call_service',
                domain,
                service,
                service_data: { entity_id: entityId, ...data }
            }, (response) => {
                if (response.success) {
                    // console.log(`✅ Service ${domain}.${service} executed successfully for ${entityId}`);
                    resolve(response.result);
                } else {
                    console.warn(`❌ Service ${domain}.${service} failed for ${entityId}:`, response.error);
                    reject(response.error);
                }
            });
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

            const id = this.messageId++; // Assuming messageId is available for use here
            const message = {
                id,
                type: 'call_service',
                domain: 'calendar',
                service: 'get_events',
                target: {
                    entity_id: entityId
                },
                service_data: {
                    start_date_time: start,
                    end_date_time: end
                },
                return_response: true
            };

            console.log('Sending Calendar Request:', JSON.stringify(message));

            // Actually send the message to the WebSocket
            this.socket!.send(JSON.stringify(message));

            const timeout = setTimeout(() => {
                console.warn(`Calendar request ${id} timed out`);
                if (this.handlers.has(id)) {
                    this.handlers.delete(id);
                    resolve([]);
                }
            }, 15000);

            this.handlers.set(id, (response: any) => {
                clearTimeout(timeout);
                console.log('Raw Calendar Response:', JSON.stringify(response));

                if (response.success && response.result) {
                    let events: any[] = [];
                    const res = response.result;

                    // 1. Try Direct Path (Best for performance and accuracy)
                    if (res.response && res.response[entityId] && Array.isArray(res.response[entityId].events)) {
                        events = res.response[entityId].events;
                        console.log(`✅ Found ${events.length} events via res.response path`);
                    }
                    // 2. Try Standard Path (res[entityId].events)
                    else if (res[entityId] && Array.isArray(res[entityId].events)) {
                        events = res[entityId].events;
                        console.log(`✅ Found ${events.length} events via res[entityId] path`);
                    }
                    // 3. Try Recursive Fallback (if structure changes)
                    else {
                        const findEvents = (obj: any): any[] | null => {
                            if (!obj || typeof obj !== 'object') return null;
                            if (Array.isArray(obj.events)) return obj.events;

                            for (const key of Object.keys(obj)) {
                                if (key === 'context' || key === 'id') continue;
                                const found = findEvents(obj[key]);
                                if (found) return found;
                            }
                            return null;
                        };
                        events = findEvents(res) || [];
                        console.log(`⚠️ Used recursive search, found ${events.length} events`);
                    }

                    resolve(events);
                } else {
                    console.warn('Call failed or no result', response);
                    resolve([]);
                }
            });
        });
    }
    async browseMedia(entityId: string, mediaContentId?: string, mediaContentType?: string): Promise<any> {
        if (!this.isConnected()) {
            console.warn('Browse Media aborted: Not connected');
            return null;
        }

        // console.log(`🔍 Browsing Media for ${entityId}`, { mediaContentId, mediaContentType });

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
                // console.log('📦 Browse Response:', JSON.stringify(response, null, 2));

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

                    // console.log(`✅ Found ${result.children?.length || 0} items for ${result.title}`);
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

    async fetchTodoItems(entityId: string): Promise<any[]> {
        console.log(`fetching todo items for ${entityId}`);
        return new Promise((resolve) => {
            if (!this.isConnected()) {
                resolve([]);
                return;
            }

            this.send({
                type: 'call_service',
                domain: 'todo',
                service: 'get_items',
                service_data: {
                    entity_id: entityId
                },
                return_response: true
            }, (response) => {
                if (response.success && response.result) {
                    let items: any[] = [];
                    const res = response.result;
                    // 1. Try Direct Path
                    if (res.response && res.response[entityId] && Array.isArray(res.response[entityId].items)) {
                        items = res.response[entityId].items;
                    }
                    // 2. Try Recursive Fallback
                    else {
                        const findItems = (obj: any): any[] | null => {
                            if (!obj || typeof obj !== 'object') return null;
                            if (Array.isArray(obj.items)) return obj.items;
                            for (const key of Object.keys(obj)) {
                                if (key === 'context' || key === 'id') continue;
                                const found = findItems(obj[key]);
                                if (found) return found;
                            }
                            return null;
                        };
                        items = findItems(res) || [];
                    }
                    resolve(items);
                } else {
                    console.warn('Fetch todo failed', response);
                    resolve([]);
                }
            });
        });
    }

    async updateTodoItem(entityId: string, itemSummary: string, status: 'completed' | 'needs_action') {
        // HA Todo update_item usually requires 'item' (summary) or 'uid'.
        // We will try updating by summary if UID not available, but 'item' attribute in service call typically takes the summary.
        return this.callService('todo', 'update_item', entityId, {
            item: itemSummary,
            status: status
        });
    }

    async addTodoItem(entityId: string, itemSummary: string) {
        return this.callService('todo', 'add_item', entityId, {
            item: itemSummary
        });
    }

    async fetchWeatherForecast(entityId: string, forecastType: 'daily' | 'hourly' = 'daily'): Promise<any[]> {

        return new Promise((resolve) => {
            if (!this.isConnected()) {
                console.warn('Cannot fetch forecast - not connected');
                resolve([]);
                return;
            }

            const id = this.messageId++;
            const message = {
                id,
                type: 'call_service',
                domain: 'weather',
                service: 'get_forecasts',
                target: {
                    entity_id: entityId
                },
                service_data: {
                    type: forecastType
                },
                return_response: true
            };



            this.socket!.send(JSON.stringify(message));

            const timeout = setTimeout(() => {
                console.warn(`Weather forecast request ${id} timed out`);
                if (this.handlers.has(id)) {
                    this.handlers.delete(id);
                    resolve([]);
                }
            }, 15000);

            this.handlers.set(id, (response: any) => {
                clearTimeout(timeout);
                // console.log('Raw Weather Forecast Response:', JSON.stringify(response));

                if (response.success && response.result) {
                    let forecast: any[] = [];
                    const res = response.result;

                    // 1. Try Direct Path (res.response[entityId].forecast)
                    if (res.response && res.response[entityId] && Array.isArray(res.response[entityId].forecast)) {
                        forecast = res.response[entityId].forecast;

                    }
                    // 2. Try res[entityId].forecast
                    else if (res[entityId] && Array.isArray(res[entityId].forecast)) {
                        forecast = res[entityId].forecast;

                    }
                    // 3. Try Recursive Fallback
                    else {
                        const findForecast = (obj: any): any[] | null => {
                            if (!obj || typeof obj !== 'object') return null;
                            if (Array.isArray(obj.forecast)) return obj.forecast;
                            for (const key of Object.keys(obj)) {
                                if (key === 'context' || key === 'id') continue;
                                const found = findForecast(obj[key]);
                                if (found) return found;
                            }
                            return null;
                        };
                        forecast = findForecast(res) || [];

                    }

                    resolve(forecast);
                } else {
                    console.warn('Weather forecast call failed or no result', response);
                    resolve([]);
                }
            });
        });
    }

    // Camera Stream: request HLS stream URL from HA
    async getCameraStream(entityId: string): Promise<string | null> {
        if (!this.isConnected() || !this.credentials) {
            return null;
        }

        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                resolve(null);
            }, 10000);

            this.send({
                type: 'camera/stream',
                entity_id: entityId,
            }, (response) => {
                clearTimeout(timeout);
                if (response.success && response.result?.url) {
                    // Build full URL from base
                    const fullUrl = `${this.credentials!.url}${response.result.url}`;
                    resolve(fullUrl);
                } else {
                    console.warn('Camera stream request failed:', response);
                    resolve(null);
                }
            });
        });
    }
}
