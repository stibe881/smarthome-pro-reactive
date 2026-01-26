import React, { useEffect, useState } from 'react';
import { HomeAssistantService } from '../services/homeAssistant';

interface CalendarModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    entityId: string; // The primary calendar entity to fetch
    haService: HomeAssistantService;
    currentEntity?: any; // Fallback entity data
    daysToFetch?: number; // Optional custom range (default 30)
    maxEvents?: number; // Optional max items to show
}

interface CalendarEvent {
    summary: string;
    start: string; // ISO date string
    end: string;
    description?: string;
    location?: string;
}

export const CalendarModal: React.FC<CalendarModalProps> = ({
    isOpen,
    onClose,
    title,
    entityId,
    haService,
    currentEntity,
    daysToFetch = 30, // Default 30 days
    maxEvents
}) => {
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && entityId) {
            setLoading(true);
            const now = new Date();
            const end = new Date();
            end.setDate(now.getDate() + daysToFetch); // Use custom range

            // Format as ISO string required by HA
            const startStr = now.toISOString();
            const endStr = end.toISOString();

            haService.fetchCalendarEvents(entityId, startStr, endStr)
                .then(data => {
                    // IF no events found via API, but we have attribute data, use that
                    if ((!data || data.length === 0) && currentEntity?.attributes?.start_time) {
                        const fallbackEvent: CalendarEvent = {
                            summary: currentEntity.attributes.message || 'Nächster Termin',
                            start: currentEntity.attributes.start_time,
                            end: currentEntity.attributes.end_time || currentEntity.attributes.start_time,
                            description: currentEntity.attributes.description || '',
                            location: currentEntity.attributes.location
                        };
                        setEvents([fallbackEvent]);
                    } else {
                        // Apply limit if specified
                        const finalEvents = maxEvents ? data.slice(0, maxEvents) : data;
                        setEvents(finalEvents);
                    }
                    setLoading(false);
                })
                .catch(() => {
                    // Fallback on error too
                    if (currentEntity?.attributes?.start_time) {
                        const fallbackEvent: CalendarEvent = {
                            summary: currentEntity.attributes.message || 'Nächster Termin',
                            start: currentEntity.attributes.start_time,
                            end: currentEntity.attributes.end_time || currentEntity.attributes.start_time,
                            description: currentEntity.attributes.description || '', // Empty if not present
                            location: currentEntity.attributes.location
                        };
                        setEvents([fallbackEvent]);
                    } else {
                        setEvents([]);
                    }
                    setLoading(false);
                });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, entityId, daysToFetch, maxEvents]);

    if (!isOpen) return null;

    // Group events by date
    const groupedEvents = events.reduce((acc, event) => {
        const date = new Date(event.start).toLocaleDateString('de-DE', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        if (!acc[date]) acc[date] = [];
        acc[date].push(event);
        return acc;
    }, {} as Record<string, CalendarEvent[]>);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-[#121212] border border-white/10 w-full max-w-lg max-h-[80vh] rounded-3xl overflow-hidden flex flex-col shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b border-white/5 flex items-center justify-between bg-[#1a1a1a]">
                    <h2 className="text-xl font-bold flex items-center gap-3">
                        <i className="fa-solid fa-calendar-days text-blue-500"></i>
                        {title}
                    </h2>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                    >
                        <i className="fa-solid fa-xmark"></i>
                    </button>
                </div>

                {/* Content */}
                <div className="overflow-y-auto p-6 space-y-6 flex-1 custom-scrollbar">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                            <i className="fa-solid fa-circle-notch fa-spin text-2xl mb-2"></i>
                            <p>Lade Termine...</p>
                        </div>
                    ) : events.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <i className="fa-regular fa-calendar-xmark text-4xl mb-3 opacity-50"></i>
                            <p>Keine Termine in den nächsten {daysToFetch} Tagen</p>
                        </div>
                    ) : (
                        Object.entries(groupedEvents).map(([date, dateEvents]) => (
                            <div key={date}>
                                <h3 className="text-sm font-bold text-blue-400 uppercase tracking-widest mb-3 sticky top-0 bg-[#121212] py-2 z-10">
                                    {date}
                                </h3>
                                <div className="space-y-3">
                                    {dateEvents.map((event, idx) => {
                                        const startDate = new Date(event.start);
                                        const endDate = new Date(event.end);

                                        // Check if it's an all-day event (usually midnight to midnight)
                                        // Or if it's specifically the "Geburtstage" calendar
                                        const isAllDay = (startDate.getHours() === 0 && startDate.getMinutes() === 0) || title.toLowerCase().includes('geburtstag');

                                        return (
                                            <div key={idx} className="bg-white/5 p-4 rounded-xl border border-white/5 hover:border-blue-500/30 transition-colors">
                                                <div className="flex items-start gap-4">
                                                    <div className="flex flex-col items-center min-w-[50px] pt-1">
                                                        {isAllDay ? (
                                                            <div className="text-blue-400">
                                                                <i className="fa-solid fa-calendar-day text-2xl"></i>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <span className="text-lg font-black text-white">
                                                                    {startDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                                {event.end && event.end !== event.start && (
                                                                    <span className="text-xs text-gray-500 font-bold mb-0.5">
                                                                        bis {endDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                                                                    </span>
                                                                )}
                                                                <span className="text-[10px] text-gray-600 uppercase font-bold">Uhr</span>
                                                            </>
                                                        )}
                                                    </div>
                                                    <div className="px-3 border-l border-white/10 flex-1 min-w-0">
                                                        <h4 className="font-bold text-lg leading-tight mb-1 break-words">{event.summary}</h4>
                                                        {event.description && <p className="text-gray-400 text-sm line-clamp-2 break-words">{event.description}</p>}
                                                        {event.location && (
                                                            <div className="flex items-center gap-2 mt-2 text-xs text-gray-500 break-all">
                                                                <i className="fa-solid fa-location-dot flex-shrink-0"></i>
                                                                {event.location}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
